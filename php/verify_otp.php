<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Verify OTP API
// POST: email, token, type
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed.');
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim($input['email'] ?? '');
$token = trim($input['token'] ?? '');
$type  = $input['type']  ?? '';

if (!$email || !$token || !$type) {
    sendResponse(false, 'Email, code, and type are required.');
}

$conn = getConnection();

// Find a valid, unused, unexpired token
$stmt = $conn->prepare(
    'SELECT id FROM `otp_tokens`
     WHERE email = ? AND token = ? AND type = ?
       AND usedAt IS NULL AND expiresAt > NOW()
     LIMIT 1'
);
$stmt->bind_param('sss', $email, $token, $type);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close(); $conn->close();
    sendResponse(false, 'Invalid or expired code. Please request a new one.');
}

$row = $result->fetch_assoc();
$stmt->close();

// Mark token as used
$markUsed = $conn->prepare('UPDATE `otp_tokens` SET usedAt = NOW() WHERE id = ?');
$markUsed->bind_param('i', $row['id']);
$markUsed->execute();
$markUsed->close();

if ($type === 'verify_email') {
    // Activate the account
    $activate = $conn->prepare('UPDATE `user` SET emailVerified = 1 WHERE email = ?');
    $activate->bind_param('s', $email);
    $activate->execute();
    $activate->close();
    $conn->close();
    sendResponse(true, 'Email verified successfully! You can now log in.');

} elseif ($type === 'reset_password') {
    // Issue a short-lived reset session token so the next step can set password
    startSession();
    $_SESSION['reset_email']   = $email;
    $_SESSION['reset_verified'] = true;
    $_SESSION['reset_expires'] = time() + 600; // 10 min
    $conn->close();
    sendResponse(true, 'Code verified. You may now set a new password.');
}

$conn->close();
sendResponse(false, 'Unknown type.');
