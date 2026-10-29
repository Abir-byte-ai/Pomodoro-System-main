<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

// ============================================
// Get Session User Info API
// Time Management and Pomodoro Tracker
// Returns logged-in user's name and email
// for populating the sidebar dynamically
// ============================================

require_once __DIR__ . '/config.php';

$userId = requireAuth();
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse(false, 'Method not allowed.');
}

sendResponse(true, 'Session data retrieved.', [
    'userId'    => $_SESSION['user_id'],
    'userName'  => $_SESSION['user_name'],
    'userEmail' => $_SESSION['user_email']
]);