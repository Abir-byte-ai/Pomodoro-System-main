<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Update Profile API
// POST: action = 'update_name' | 'update_avatar'
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

$userId = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    sendResponse(false, 'Method not allowed.');
}

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_POST['action'] ?? '';

$conn = getConnection();

// ---- Update display name ----
if ($action === 'update_name') {
    $newName = trim($input['name'] ?? '');

    if (strlen($newName) < 2) {
        $conn->close();
        sendResponse(false, 'Name must be at least 2 characters.');
    }
    if (strlen($newName) > 100) {
        $conn->close();
        sendResponse(false, 'Name cannot exceed 100 characters.');
    }

    $stmt = $conn->prepare('UPDATE `user` SET name = ? WHERE userID = ?');
    $stmt->bind_param('si', $newName, $userId);
    $stmt->execute();
    $stmt->close();
    $conn->close();

    // Update session
    startSession();
    $_SESSION['user_name'] = $newName;

    sendResponse(true, 'Name updated successfully.', ['name' => $newName]);
}

// ---- Update avatar (base64 stored in DB or just initials colour) ----
// For AwardSpace free hosting we store a chosen colour/initial, not a real image file
if ($action === 'update_avatar_color') {
    $color = trim($input['color'] ?? '');
    $allowed = ['#667eea','#48bb78','#f6ad55','#fc8181','#63b3ed','#b794f4','#f687b3','#4fd1c5'];

    if (!in_array($color, $allowed)) {
        $conn->close();
        sendResponse(false, 'Invalid colour selection.');
    }

    $stmt = $conn->prepare('UPDATE `user` SET avatarColor = ? WHERE userID = ?');
    // avatarColor column may not exist yet — add it gracefully
    if (!$stmt) {
        // Column missing — try to add it first
        $conn->query('ALTER TABLE `user` ADD COLUMN IF NOT EXISTS `avatarColor` VARCHAR(7) DEFAULT NULL');
        $stmt = $conn->prepare('UPDATE `user` SET avatarColor = ? WHERE userID = ?');
    }
    $stmt->bind_param('si', $color, $userId);
    $stmt->execute();
    $stmt->close();
    $conn->close();

    startSession();
    $_SESSION['avatar_color'] = $color;

    sendResponse(true, 'Avatar colour updated.', ['color' => $color]);
}

$conn->close();
sendResponse(false, 'Unknown action.');
