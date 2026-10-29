<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Register API
// Time Management and Pomodoro Tracker
// POST: name, email, password
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed. Use POST.');
}

// Get and decode JSON body
$input = json_decode(file_get_contents('php://input'), true);

// Fallback to $_POST if not JSON
if (!$input) {
    $input = $_POST;
}

// Get fields
$name     = trim($input['name'] ?? '');
$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

// ---- Validation ----

if (empty($name) || empty($email) || empty($password)) {
    sendResponse(false, 'All fields are required.');
}

if (strlen($name) < 2) {
    sendResponse(false, 'Name must be at least 2 characters.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please enter a valid email address.');
}

if (strlen($password) < 6) {
    sendResponse(false, 'Password must be at least 6 characters.');
}

// ---- Database operations ----

$conn = getConnection();

// Check if email already exists
$checkStmt = $conn->prepare('SELECT userID FROM `user` WHERE email = ?');
$checkStmt->bind_param('s', $email);
$checkStmt->execute();
$checkStmt->store_result();

if ($checkStmt->num_rows > 0) {
    $checkStmt->close();
    $conn->close();
    sendResponse(false, 'This email is already registered. Please use a different email or login.');
}

$checkStmt->close();

// Hash the password
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

// Insert new user
$insertStmt = $conn->prepare('INSERT INTO `user` (name, email, passwordHash) VALUES (?, ?, ?)');
$insertStmt->bind_param('sss', $name, $email, $passwordHash);

if ($insertStmt->execute()) {
    $newUserId = $conn->insert_id;
    $insertStmt->close();
    $conn->close();

    sendResponse(true, 'Account created successfully! Redirecting to login...', [
        'userId' => $newUserId
    ]);
} else {
    $insertStmt->close();
    $conn->close();
    sendResponse(false, 'Registration failed. Please try again.');
}