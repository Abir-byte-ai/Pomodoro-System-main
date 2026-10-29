<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
require_once __DIR__ . '/config.php';
startSession();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();
header('Location: ../login.html');
exit();
