<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Save Timer State API (30-second heartbeat)
// POST: remainingTime, duration, isRunning, mode
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed.');
}

$userId = requireAuth();

$input         = json_decode(file_get_contents('php://input'), true) ?? [];
$remainingTime = intval($input['remainingTime'] ?? 0);
$duration      = intval($input['duration']      ?? 25);
$isRunning     = !empty($input['isRunning']) ? 1 : 0;

if ($remainingTime < 0 || $remainingTime > 7200) {
    sendResponse(false, 'Invalid remaining time.');
}

$conn = getConnection();

// Upsert: update existing row or insert new one
$check = $conn->prepare('SELECT timerID FROM `timer` WHERE userID = ? LIMIT 1');
$check->bind_param('i', $userId);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    $check->close();
    $upd = $conn->prepare(
        'UPDATE `timer` SET remainingTime = ?, duration = ?, isRunning = ?, lastUpdated = NOW()
         WHERE userID = ?'
    );
    $upd->bind_param('iiii', $remainingTime, $duration, $isRunning, $userId);
    $upd->execute();
    $upd->close();
} else {
    $check->close();
    $ins = $conn->prepare(
        'INSERT INTO `timer` (userID, duration, remainingTime, isRunning) VALUES (?, ?, ?, ?)'
    );
    $ins->bind_param('iiii', $userId, $duration, $remainingTime, $isRunning);
    $ins->execute();
    $ins->close();
}

$conn->close();
sendResponse(true, 'Timer state saved.');
