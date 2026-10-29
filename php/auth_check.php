<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
require_once __DIR__ . '/config.php';
startSession();
if (!isset($_SESSION['user_id'])) { header('Location: /login.html'); exit(); }
$sessionUserId    = $_SESSION['user_id'];
$sessionUserName  = $_SESSION['user_name']  ?? 'User';
$sessionUserEmail = $_SESSION['user_email'] ?? '';
