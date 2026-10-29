<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Send OTP API
// POST: email, type ('verify_email' | 'reset_password')
// ============================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/mailer.php';

setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed.');
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim($input['email'] ?? '');
$type  = $input['type']  ?? '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please enter a valid email address.');
}

$validTypes = ['verify_email', 'reset_password'];
if (!in_array($type, $validTypes)) {
    sendResponse(false, 'Invalid OTP type.');
}

$conn = getConnection();

// For reset_password: email must exist in user table and be verified
if ($type === 'reset_password') {
    $chk = $conn->prepare('SELECT name FROM `user` WHERE email = ? AND emailVerified = 1 LIMIT 1');
    $chk->bind_param('s', $email);
    $chk->execute();
    $chk->store_result();
    if ($chk->num_rows === 0) {
        $chk->close(); $conn->close();
        // Generic message to avoid user enumeration
        sendResponse(true, 'If that email exists in our system, a reset code has been sent.');
    }
    $chk->bind_result($userName);
    $chk->fetch();
    $chk->close();
} else {
    // verify_email — get name from temp session or use email prefix
    startSession();
    $userName = $_SESSION['pending_name'] ?? explode('@', $email)[0];
}

// Rate-limit: max 3 OTPs per email per type in last 10 minutes
$rateChk = $conn->prepare(
    'SELECT COUNT(*) as cnt FROM `otp_tokens`
     WHERE email = ? AND type = ? AND expiresAt > NOW() - INTERVAL 10 MINUTE'
);
$rateChk->bind_param('ss', $email, $type);
$rateChk->execute();
$rateRow = $rateChk->get_result()->fetch_assoc();
$rateChk->close();

if ($rateRow['cnt'] >= 3) {
    $conn->close();
    sendResponse(false, 'Too many codes requested. Please wait a few minutes before trying again.');
}

// Invalidate any old unused tokens for this email+type
$del = $conn->prepare('DELETE FROM `otp_tokens` WHERE email = ? AND type = ? AND usedAt IS NULL');
$del->bind_param('ss', $email, $type);
$del->execute();
$del->close();

// Generate 6-digit OTP
$otp       = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expiresAt = date('Y-m-d H:i:s', time() + 900); // 15 minutes

$ins = $conn->prepare('INSERT INTO `otp_tokens` (email, token, type, expiresAt) VALUES (?, ?, ?, ?)');
$ins->bind_param('ssss', $email, $otp, $type, $expiresAt);
$ins->execute();
$ins->close();
$conn->close();

$sent = sendOtpEmail($email, $userName, $otp, $type);

// We return success regardless of mail() result to avoid enumeration,
// but log failures server-side for debugging.
if (!$sent) {
    error_log("Pomodoro Tracker: mail() failed for {$email} ({$type})");
}

sendResponse(true, 'If that email exists, a verification code has been sent. Check your inbox (and spam folder).');
