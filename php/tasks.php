<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

// ============================================
// Tasks API 
// Time Management and Pomodoro Tracker
// GET    → fetch all tasks for logged-in user
// POST   → create new task
// PUT    → update task (edit or mark complete)
// DELETE → delete task
// ============================================

require_once __DIR__ . '/config.php';

$userId = requireAuth();

setJsonHeaders();
$method = $_SERVER['REQUEST_METHOD'];

$conn = getConnection();

// GET - Fetch tasks with optional date range
if ($method === 'GET') {
    $filter    = $_GET['filter']    ?? 'all';
    $startDate = $_GET['startDate'] ?? null;
    $endDate   = $_GET['endDate']   ?? null;

    // Validate date formats if provided
    $useRange = false;
    if ($startDate && $endDate &&
        preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) &&
        preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate) &&
        strtotime($startDate) <= strtotime($endDate)) {
        $useRange = true;
    }

    // Build WHERE clauses
    $statusClause = '';
    $rangeClause  = '';

    if ($filter === 'pending' || $filter === 'completed') {
        $statusClause = 'AND status = ?';
    }

    if ($useRange) {
        // For pending tasks filter by deadline or createdAt in range
        // For completed tasks filter by completedAt in range
        // For all tasks, use createdAt in range
        if ($filter === 'completed') {
            $rangeClause = 'AND DATE(completedAt) BETWEEN ? AND ?';
        } else {
            $rangeClause = 'AND DATE(createdAt) BETWEEN ? AND ?';
        }
    }

    $sql = "SELECT taskID, title, description, status, priority, deadline, createdAt, completedAt
            FROM `task`
            WHERE userID = ? {$statusClause} {$rangeClause}
            ORDER BY
              CASE status WHEN 'pending' THEN 1 ELSE 2 END,
              CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              createdAt DESC";

    $stmt = $conn->prepare($sql);

    // Bind params dynamically based on what filters are active
    if ($filter !== 'all' && $useRange) {
        $stmt->bind_param('isss', $userId, $filter, $startDate, $endDate);
    } elseif ($filter !== 'all') {
        $stmt->bind_param('is', $userId, $filter);
    } elseif ($useRange) {
        $stmt->bind_param('iss', $userId, $startDate, $endDate);
    } else {
        $stmt->bind_param('i', $userId);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    $tasks = [];
    while ($row = $result->fetch_assoc()) {
        $tasks[] = $row;
    }
    $stmt->close();

    // Summary counts (always counts all tasks regardless of date filter)
    $countStmt = $conn->prepare(
        'SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = "pending"   THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed
         FROM `task` WHERE userID = ?'
    );
    $countStmt->bind_param('i', $userId);
    $countStmt->execute();
    $counts = $countStmt->get_result()->fetch_assoc();
    $countStmt->close();
    $conn->close();

    sendResponse(true, 'Tasks fetched successfully.', [
        'tasks'   => $tasks,
        'summary' => $counts,
        'filters' => [
            'status'    => $filter,
            'startDate' => $startDate,
            'endDate'   => $endDate,
            'count'     => count($tasks)
        ]
    ]);
}

// POST - Create new task
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $title       = trim($input['title'] ?? '');
    $description = trim($input['description'] ?? '');
    $priority    = $input['priority'] ?? 'medium';
    $deadline    = $input['deadline'] ?? null;

    if (empty($title)) {
        $conn->close();
        sendResponse(false, 'Task title is required.');
    }

    $validPriorities = ['high', 'medium', 'low'];
    if (!in_array($priority, $validPriorities)) $priority = 'medium';

    if ($deadline && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline)) $deadline = null;

    $stmt = $conn->prepare(
        'INSERT INTO `task` (userID, title, description, priority, deadline, status)
         VALUES (?, ?, ?, ?, ?, "pending")'
    );
    $stmt->bind_param('issss', $userId, $title, $description, $priority, $deadline);

    if ($stmt->execute()) {
        $newTaskId = $conn->insert_id;
        $stmt->close();
        $conn->close();
        sendResponse(true, 'Task created successfully.', ['taskId' => $newTaskId]);
    } else {
        $stmt->close();
        $conn->close();
        sendResponse(false, 'Failed to create task. Please try again.');
    }
}

// PUT - Update task
if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) { $conn->close(); sendResponse(false, 'Invalid request data.'); }

    $taskId = intval($input['taskId'] ?? 0);
    if (!$taskId) { $conn->close(); sendResponse(false, 'Task ID is required.'); }

    $checkStmt = $conn->prepare('SELECT taskID FROM `task` WHERE taskID = ? AND userID = ?');
    $checkStmt->bind_param('ii', $taskId, $userId);
    $checkStmt->execute();
    $checkStmt->store_result();

    if ($checkStmt->num_rows === 0) {
        $checkStmt->close(); $conn->close();
        sendResponse(false, 'Task not found.');
    }
    $checkStmt->close();

    if (isset($input['status'])) {
        $newStatus   = $input['status'] === 'completed' ? 'completed' : 'pending';
        $completedAt = $newStatus === 'completed' ? date('Y-m-d H:i:s') : null;

        $stmt = $conn->prepare(
            'UPDATE `task` SET status = ?, completedAt = ? WHERE taskID = ? AND userID = ?'
        );
        $stmt->bind_param('ssii', $newStatus, $completedAt, $taskId, $userId);
    } else {
        $title       = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $priority    = $input['priority'] ?? 'medium';
        $deadline    = $input['deadline'] ?? null;

        if (empty($title)) { $conn->close(); sendResponse(false, 'Task title is required.'); }

        $stmt = $conn->prepare(
            'UPDATE `task` SET title = ?, description = ?, priority = ?, deadline = ?
             WHERE taskID = ? AND userID = ?'
        );
        $stmt->bind_param('ssssii', $title, $description, $priority, $deadline, $taskId, $userId);
    }

    if ($stmt->execute()) {
        $stmt->close(); $conn->close();
        sendResponse(true, 'Task updated successfully.');
    } else {
        $stmt->close(); $conn->close();
        sendResponse(false, 'Failed to update task.');
    }
}

// DELETE - Delete a task
if ($method === 'DELETE') {
    $taskId = intval($_GET['taskId'] ?? 0);

    if (!$taskId) { $conn->close(); sendResponse(false, 'Task ID is required.'); }

    $stmt = $conn->prepare('DELETE FROM `task` WHERE taskID = ? AND userID = ?');
    $stmt->bind_param('ii', $taskId, $userId);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        $stmt->close(); $conn->close();
        sendResponse(true, 'Task deleted successfully.');
    } else {
        $stmt->close(); $conn->close();
        sendResponse(false, 'Task not found or could not be deleted.');
    }
}

$conn->close();
sendResponse(false, 'Invalid request method.');