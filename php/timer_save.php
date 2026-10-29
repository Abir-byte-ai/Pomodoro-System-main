<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');
// ============================================
// Timer Save API
// Time Management and Pomodoro Tracker
// POST: saves a completed Pomodoro session
// ============================================

require_once __DIR__ . '/config.php';

setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Method not allowed. Use POST.');
}

$userId = requireAuth();

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// Get session data
$taskId    = !empty($input['taskId']) ? intval($input['taskId']) : null;
$duration  = intval($input['duration'] ?? 25);
$type      = $input['type'] ?? 'work'; // work | shortBreak | longBreak
$startTime = $input['startTime'] ?? null;
$endTime   = $input['endTime'] ?? date('Y-m-d H:i:s');

// Validate type
$validTypes = ['work', 'shortBreak', 'longBreak'];
if (!in_array($type, $validTypes)) {
    $type = 'work';
}

// Validate duration
if ($duration < 1 || $duration > 120) {
    $duration = 25;
}

// Calculate startTime if not provided
if (!$startTime) {
    $startTime = date('Y-m-d H:i:s', strtotime($endTime) - ($duration * 60));
}

$conn = getConnection();

// If taskId provided, verify it belongs to this user
if ($taskId) {
    $checkStmt = $conn->prepare('SELECT taskID FROM `task` WHERE taskID = ? AND userID = ?');
    $checkStmt->bind_param('ii', $taskId, $userId);
    $checkStmt->execute();
    $checkStmt->store_result();

    if ($checkStmt->num_rows === 0) {
        $taskId = null;
    }
    $checkStmt->close();
}

// Insert Pomodoro session
$sessionStmt = $conn->prepare(
    'INSERT INTO `pomodorosession` (taskID, userID, duration, startTime, endTime, type)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$sessionStmt->bind_param('iiisss', $taskId, $userId, $duration, $startTime, $endTime, $type);

if (!$sessionStmt->execute()) {
    $sessionStmt->close();
    $conn->close();
    sendResponse(false, 'Failed to save session.');
}

$sessionId = $conn->insert_id;
$sessionStmt->close();

// Update ProgressRecord (only for work sessions)
if ($type === 'work') {
    $today = date('Y-m-d');

    // Check if a progress record exists for today
    $checkProg = $conn->prepare(
        'SELECT recordID, totalMinutes FROM `progressrecord` WHERE userID = ? AND date = ? LIMIT 1'
    );
    $checkProg->bind_param('is', $userId, $today);
    $checkProg->execute();
    $progResult = $checkProg->get_result();
    $checkProg->close();

    if ($progResult->num_rows > 0) {
        // Update existing record
        $progRow = $progResult->fetch_assoc();
        $newTotal = $progRow['totalMinutes'] + $duration;

        $updateProg = $conn->prepare(
            'UPDATE ProgressRecord SET totalMinutes = ?, sessionID = ? WHERE recordID = ?'
        );
        $updateProg->bind_param('iii', $newTotal, $sessionId, $progRow['recordID']);
        $updateProg->execute();
        $updateProg->close();
    } else {
        // Insert new progress record
        $insertProg = $conn->prepare(
            'INSERT INTO `progressrecord` (sessionID, userID, date, totalMinutes) VALUES (?, ?, ?, ?)'
        );
        $insertProg->bind_param('isis', $sessionId, $userId, $today, $duration);
        $insertProg->execute();
        $insertProg->close();
    }

    // Get updated today's stats to return
    $statsStmt = $conn->prepare(
        'SELECT
            COUNT(*) as sessionsToday,
            COALESCE(SUM(duration), 0) as minutesToday
         FROM `pomodorosession`
         WHERE userID = ? AND DATE(startTime) = ? AND type = "work"'
    );
    $statsStmt->bind_param('is', $userId, $today);
    $statsStmt->execute();
    $stats = $statsStmt->get_result()->fetch_assoc();
    $statsStmt->close();
}

$conn->close();

sendResponse(true, 'Session saved successfully.', [
    'sessionId'     => $sessionId,
    'sessionsToday' => $stats['sessionsToday'] ?? 0,
    'minutesToday'  => $stats['minutesToday'] ?? 0
]);
