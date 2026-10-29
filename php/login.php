<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
require_once __DIR__ . '/config.php';
setJsonHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendResponse(false, 'Method not allowed.');
$input    = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$email    = trim($input['email']    ?? '');
$password = $input['password'] ?? '';
if (empty($email) || empty($password)) sendResponse(false, 'Email and password are required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) sendResponse(false, 'Please enter a valid email address.');
$conn = getConnection();
$stmt = $conn->prepare('SELECT userID, name, email, passwordHash FROM `user` WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) { $stmt->close(); $conn->close(); sendResponse(false, 'Invalid email or password.'); }
$user = $result->fetch_assoc();
$stmt->close(); $conn->close();
if (!password_verify($password, $user['passwordHash'])) sendResponse(false, 'Invalid email or password.');
startSession();
$_SESSION['user_id']    = $user['userID'];
$_SESSION['user_name']  = $user['name'];
$_SESSION['user_email'] = $user['email'];
$_SESSION['logged_in']  = true;
session_regenerate_id(true);
sendResponse(true, 'Login successful!', ['userId' => $user['userID'], 'userName' => $user['name'], 'userEmail' => $user['email']]);
