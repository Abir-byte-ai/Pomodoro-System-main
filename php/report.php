<?php
// ============================================
// Report
// Time Management and Pomodoro Tracker
// ============================================
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/config.php';

$userId = requireAuth();   // session_start() BEFORE any header()
setJsonHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$conn   = getConnection();

if ($method !== 'GET') {
    $conn->close();
    sendResponse(false, 'Invalid request method.');
}

$endDate   = $_GET['endDate']   ?? date('Y-m-d');
$startDate = $_GET['startDate'] ?? date('Y-m-d', strtotime('-30 days'));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) ||
    !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
    $conn->close();
    sendResponse(false, 'Invalid date format. Use YYYY-MM-DD.');
}

if (strtotime($startDate) > strtotime($endDate)) {
    $conn->close();
    sendResponse(false, 'Start date cannot be after end date.');
}

// ---- Helper ----
function calcChange($current, $previous) {
    if ($previous == 0) return $current > 0 ? 100 : 0;
    return round((($current - $previous) / $previous) * 100);
}

function safeQuery($conn, $sql, $types, ...$params) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;
    if ($types) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();
    return $result;
}

// ---- Date ranges ----
$periodDays    = (strtotime($endDate) - strtotime($startDate)) / 86400 + 1;
$prevEndDate   = date('Y-m-d', strtotime($startDate) - 86400);
$prevStartDate = date('Y-m-d', strtotime($prevEndDate) - ($periodDays - 1) * 86400);

// ---- Current period summary ----
$summarySQL = 'SELECT
    COUNT(CASE WHEN type = "work" THEN 1 END) as totalSessions,
    COALESCE(SUM(CASE WHEN type = "work" THEN duration END), 0) as totalMinutes,
    COUNT(DISTINCT DATE(startTime)) as activeDays
 FROM `pomodorosession`
 WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ?';

$summaryRes = safeQuery($conn, $summarySQL, 'iss', $userId, $startDate, $endDate);
$summary    = $summaryRes ? $summaryRes->fetch_assoc() : ['totalSessions'=>0,'totalMinutes'=>0,'activeDays'=>0];

$taskRes    = safeQuery($conn,
    'SELECT COUNT(*) as completedTasks FROM `task`
     WHERE userID = ? AND status = "completed" AND DATE(completedAt) BETWEEN ? AND ?',
    'iss', $userId, $startDate, $endDate);
$taskSummary = $taskRes ? $taskRes->fetch_assoc() : ['completedTasks'=>0];

// ---- Previous period ----
$prevRes     = safeQuery($conn, $summarySQL, 'iss', $userId, $prevStartDate, $prevEndDate);
$prevSummary = $prevRes ? $prevRes->fetch_assoc() : ['totalSessions'=>0,'totalMinutes'=>0,'activeDays'=>0];

$prevTaskRes     = safeQuery($conn,
    'SELECT COUNT(*) as completedTasks FROM `task`
     WHERE userID = ? AND status = "completed" AND DATE(completedAt) BETWEEN ? AND ?',
    'iss', $userId, $prevStartDate, $prevEndDate);
$prevTaskSummary = $prevTaskRes ? $prevTaskRes->fetch_assoc() : ['completedTasks'=>0];

// ---- Changes ----
$sessionChange = calcChange($summary['totalSessions'], $prevSummary['totalSessions']);
$minutesChange = calcChange($summary['totalMinutes'],  $prevSummary['totalMinutes']);
$taskChange    = calcChange($taskSummary['completedTasks'], $prevTaskSummary['completedTasks']);

$totalDays     = max(1, $periodDays);
$activeDays    = intval($summary['activeDays']);
$prodScore     = round(($activeDays / $totalDays) * 100);
$prevProdScore = round((intval($prevSummary['activeDays']) / $totalDays) * 100);
$scoreChange   = calcChange($prodScore, $prevProdScore);

// ---- Current week chart data ----
$weekStart = date('Y-m-d', strtotime('monday this week'));
$weekEnd   = date('Y-m-d', strtotime('sunday this week'));

$weekRes = safeQuery($conn,
    'SELECT DAYNAME(startTime) as dayName, DAYOFWEEK(startTime) as dayNum,
            COALESCE(SUM(CASE WHEN type = "work" THEN duration END), 0) as focusMinutes,
            COUNT(CASE WHEN type = "work" THEN 1 END) as sessions
     FROM `pomodorosession`
     WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ?
     GROUP BY DAYNAME(startTime), DAYOFWEEK(startTime)
     ORDER BY DAYOFWEEK(startTime)',
    'iss', $userId, $weekStart, $weekEnd);

$currentWeekData = [];
if ($weekRes) {
    while ($row = $weekRes->fetch_assoc()) $currentWeekData[] = $row;
}

// ---- Task performance (pomodorosession — lowercase, Linux case-sensitive) ----
$taskPerfRes = safeQuery($conn,
    'SELECT t.taskID, t.title, t.priority, t.status,
            COUNT(ps.sessionID) as sessions,
            COALESCE(SUM(ps.duration), 0) as totalMinutes
     FROM `task` t
     LEFT JOIN `pomodorosession` ps ON t.taskID = ps.taskID
         AND DATE(ps.startTime) BETWEEN ? AND ?
     WHERE t.userID = ?
     GROUP BY t.taskID, t.title, t.priority, t.status
     HAVING sessions > 0
     ORDER BY totalMinutes DESC
     LIMIT 10',
    'ssi', $startDate, $endDate, $userId);

$taskPerformance = [];
if ($taskPerfRes) {
    while ($row = $taskPerfRes->fetch_assoc()) $taskPerformance[] = $row;
}

// ---- Save report record ----
$totalSessions = intval($summary['totalSessions']);
$totalMinutes  = intval($summary['totalMinutes']);
$saveStmt = $conn->prepare(
    'INSERT INTO `report` (userID, totalSessions, totalMinutes, reportPeriodStart, reportPeriodEnd)
     VALUES (?, ?, ?, ?, ?)'
);
if ($saveStmt) {
    $saveStmt->bind_param('iiiss', $userId, $totalSessions, $totalMinutes, $startDate, $endDate);
    $saveStmt->execute();
    $saveStmt->close();
}

$conn->close();

sendResponse(true, 'Report generated successfully.', [
    'period' => [
        'startDate'     => $startDate,
        'endDate'       => $endDate,
        'prevStartDate' => $prevStartDate,
        'prevEndDate'   => $prevEndDate
    ],
    'summary' => [
        'totalSessions'     => $totalSessions,
        'totalMinutes'      => $totalMinutes,
        'completedTasks'    => intval($taskSummary['completedTasks']),
        'productivityScore' => $prodScore
    ],
    'comparison' => [
        'sessionChange' => $sessionChange,
        'minutesChange' => $minutesChange,
        'taskChange'    => $taskChange,
        'scoreChange'   => $scoreChange,
        'hasPrevData'   => ($prevSummary['totalSessions'] > 0 || $prevSummary['totalMinutes'] > 0)
    ],
    'currentWeek'     => $currentWeekData,
    'weekRange'       => ['start' => $weekStart, 'end' => $weekEnd],
    'taskPerformance' => $taskPerformance
]);
