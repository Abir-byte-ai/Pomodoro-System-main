<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Mailer Helper
// Time Management and Pomodoro Tracker
// Uses PHP mail() — works on AwardSpace shared hosting
// ============================================

define('MAIL_FROM',      'no-reply@awardspace.net');
define('MAIL_FROM_NAME', 'Pomodoro Tracker');

/**
 * Send a 6-digit OTP to the given address.
 * $type: 'verify_email' | 'reset_password'
 */
function sendOtpEmail(string $toEmail, string $toName, string $otp, string $type): bool {

    if ($type === 'verify_email') {
        $subject = 'Verify your Pomodoro Tracker account';
        $body    = "Hi {$toName},\n\n"
                 . "Thanks for registering! Use the code below to verify your email address.\n\n"
                 . "Your verification code: {$otp}\n\n"
                 . "This code expires in 15 minutes.\n\n"
                 . "If you did not create an account, you can safely ignore this email.\n\n"
                 . "— Pomodoro Tracker";
    } else {
        $subject = 'Reset your Pomodoro Tracker password';
        $body    = "Hi {$toName},\n\n"
                 . "We received a request to reset your password. Use the code below.\n\n"
                 . "Your reset code: {$otp}\n\n"
                 . "This code expires in 15 minutes.\n\n"
                 . "If you did not request a password reset, ignore this email — your account is safe.\n\n"
                 . "— Pomodoro Tracker";
    }

    $headers  = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . MAIL_FROM . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

    return mail($toEmail, $subject, $body, $headers);
}