<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Reset Password API
// POST: email, newPassword (session must have reset_verified)
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed.');
}

startSession();

// Check session is valid and not expired
if (empty($_SESSION['reset_verified']) ||
    empty($_SESSION['reset_email'])    ||
    (time() > ($_SESSION['reset_expires'] ?? 0))) {

    session_unset();
    sendResponse(false, 'Your reset session has expired. Please start the reset process again.');
}

$input       = json_decode(file_get_contents('php://input'), true) ?? [];
$newPassword = $input['newPassword'] ?? '';
$email       = $_SESSION['reset_email'];

if (strlen($newPassword) < 6) {
    sendResponse(false, 'Password must be at least 6 characters.');
}

$conn = getConnection();

$hash = password_hash($newPassword, PASSWORD_BCRYPT);
$upd  = $conn->prepare('UPDATE `user` SET passwordHash = ? WHERE email = ? AND emailVerified = 1');
$upd->bind_param('ss', $hash, $email);
$upd->execute();
$affected = $upd->affected_rows;
$upd->close();
$conn->close();

// Clear reset session
unset($_SESSION['reset_verified'], $_SESSION['reset_email'], $_SESSION['reset_expires']);

if ($affected === 0) {
    sendResponse(false, 'Could not update password. Please try again.');
}

sendResponse(true, 'Password updated successfully! You can now log in with your new password.');