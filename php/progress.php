<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

// ============================================
// Progress API
// Time Management and Pomodoro Tracker
// ============================================

require_once __DIR__ . '/config.php';

$userId = requireAuth();   // session_start BEFORE any header()
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse(false, 'Method not allowed. Use GET.');
}

$conn = getConnection();

$period  = $_GET['period'] ?? 'weekly';
$days    = intval($_GET['days'] ?? 7);
$filter  = $_GET['filter'] ?? 'all';
$page    = max(1, intval($_GET['page'] ?? 1));
$perPage = 10;
$offset  = ($page - 1) * $perPage;

// Date range
$customStart = $_GET['startDate'] ?? null;
$customEnd   = $_GET['endDate']   ?? null;

if ($customStart && $customEnd &&
    preg_match('/^\d{4}-\d{2}-\d{2}$/', $customStart) &&
    preg_match('/^\d{4}-\d{2}-\d{2}$/', $customEnd)) {
    $dateFrom = $customStart;
    $dateTo   = $customEnd;
} else {
    $dateTo = date('Y-m-d');
    if ($period === 'daily') {
        $dateFrom = date('Y-m-d');
    } elseif ($period === 'monthly') {
        $dateFrom = date('Y-m-d', strtotime('-30 days'));
    } else {
        $dateFrom = date('Y-m-d', strtotime('-7 days'));
    }
}

// Safe prepare helper — returns empty result on failure instead of crashing
function safeQuery($conn, $sql, $types = '', ...$params) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) return null;
    if ($types !== '') $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();
    return $result;
}

// ---- 1. Summary Stats ----
$statsRes = safeQuery($conn,
    'SELECT
        COUNT(CASE WHEN type = "work" THEN 1 END) as totalSessions,
        COALESCE(SUM(CASE WHEN type = "work" THEN duration END), 0) as focusMinutes,
        COUNT(DISTINCT DATE(startTime)) as activeDays
     FROM `pomodorosession`
     WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ?',
    'iss', $userId, $dateFrom, $dateTo);
$stats = $statsRes ? $statsRes->fetch_assoc() : ['totalSessions'=>0,'focusMinutes'=>0,'activeDays'=>0];

$taskRes = safeQuery($conn,
    'SELECT COUNT(*) as completedTasks FROM `task`
     WHERE userID = ? AND status = "completed"
     AND DATE(completedAt) BETWEEN ? AND ?',
    'iss', $userId, $dateFrom, $dateTo);
$taskStats = $taskRes ? $taskRes->fetch_assoc() : ['completedTasks'=>0];

$activeDays   = max(1, intval($stats['activeDays']));
$dailyAverage = round(intval($stats['focusMinutes']) / $activeDays);

// ---- 2. Pie Chart Data ----
$pieRes = safeQuery($conn,
    'SELECT type,
            COUNT(*) as sessionCount,
            COALESCE(SUM(duration), 0) as totalMinutes
     FROM `pomodorosession`
     WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ?
     GROUP BY type',
    'iss', $userId, $dateFrom, $dateTo);

$pieRaw = ['work' => 0, 'shortBreak' => 0, 'longBreak' => 0];
if ($pieRes) {
    while ($row = $pieRes->fetch_assoc()) {
        if (isset($pieRaw[$row['type']])) {
            $pieRaw[$row['type']] = intval($row['totalMinutes']);
        }
    }
}

$pieTotal = array_sum($pieRaw);
$pieData  = [];
if ($pieTotal > 0) {
    foreach ($pieRaw as $type => $minutes) {
        $pieData[] = [
            'type'       => $type,
            'minutes'    => $minutes,
            'percentage' => round(($minutes / $pieTotal) * 100, 1)
        ];
    }
} else {
    $pieData = [
        ['type'=>'work',       'minutes'=>0, 'percentage'=>0],
        ['type'=>'shortBreak', 'minutes'=>0, 'percentage'=>0],
        ['type'=>'longBreak',  'minutes'=>0, 'percentage'=>0],
    ];
}

// ---- 3. Line Chart Data ----
$chartRes = safeQuery($conn,
    'SELECT
        DATE(startTime) as date,
        COALESCE(SUM(CASE WHEN type = "work" THEN duration END), 0) as focusMinutes,
        COUNT(CASE WHEN type = "work" THEN 1 END) as sessions
     FROM `pomodorosession`
     WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ?
     GROUP BY DATE(startTime)
     ORDER BY DATE(startTime) ASC',
    'iss', $userId, $dateFrom, $dateTo);

$chartData = [];
if ($chartRes) {
    while ($row = $chartRes->fetch_assoc()) $chartData[] = $row;
}

// ---- 4. Session History ----
if ($filter === 'work') {
    $typeFilter = 'AND ps.type = "work"';
} elseif ($filter === 'break') {
    $typeFilter = 'AND ps.type IN ("shortBreak", "longBreak")';
} else {
    $typeFilter = '';
}

// NOTE: table names lowercase — Linux MySQL is case-sensitive
$historySQL = "
    SELECT ps.sessionID, ps.duration, ps.type, ps.startTime, ps.endTime,
           t.title as taskTitle
    FROM `pomodorosession` ps
    LEFT JOIN `task` t ON ps.taskID = t.taskID
    WHERE ps.userID = ? AND DATE(ps.startTime) BETWEEN ? AND ? {$typeFilter}
    ORDER BY ps.startTime DESC
    LIMIT ? OFFSET ?
";

$historyRes = safeQuery($conn, $historySQL, 'issii', $userId, $dateFrom, $dateTo, $perPage, $offset);
$sessions   = [];
if ($historyRes) {
    while ($row = $historyRes->fetch_assoc()) $sessions[] = $row;
}

$countSQL = "SELECT COUNT(*) as total FROM `pomodorosession`
             WHERE userID = ? AND DATE(startTime) BETWEEN ? AND ? {$typeFilter}";
$countRes      = safeQuery($conn, $countSQL, 'iss', $userId, $dateFrom, $dateTo);
$totalSessions = $countRes ? intval($countRes->fetch_assoc()['total']) : 0;

// ---- 5. Daily Goals ----
$goalSessions = 10;
$goalMinutes  = 300;
$goalTasks    = 5;
$today        = date('Y-m-d');

$todayRes = safeQuery($conn,
    'SELECT
        COUNT(CASE WHEN type = "work" THEN 1 END) as todaySessions,
        COALESCE(SUM(CASE WHEN type = "work" THEN duration END), 0) as todayMinutes
     FROM `pomodorosession`
     WHERE userID = ? AND DATE(startTime) = ?',
    'is', $userId, $today);
$todayStats = $todayRes ? $todayRes->fetch_assoc() : ['todaySessions'=>0,'todayMinutes'=>0];

$todayTaskRes = safeQuery($conn,
    'SELECT COUNT(*) as todayTasks FROM `task`
     WHERE userID = ? AND status = "completed" AND DATE(completedAt) = ?',
    'is', $userId, $today);
$todayTaskCount = $todayTaskRes ? intval($todayTaskRes->fetch_assoc()['todayTasks']) : 0;

$conn->close();

sendResponse(true, 'Progress data fetched successfully.', [
    'dateRange' => ['from' => $dateFrom, 'to' => $dateTo],
    'summary'   => [
        'totalSessions'  => intval($stats['totalSessions']),
        'focusMinutes'   => intval($stats['focusMinutes']),
        'completedTasks' => intval($taskStats['completedTasks']),
        'dailyAverage'   => $dailyAverage
    ],
    'pieData'   => $pieData,
    'chartData' => $chartData,
    'sessions'  => [
        'list'  => $sessions,
        'total' => $totalSessions,
        'page'  => $page,
        'pages' => (int)ceil($totalSessions / $perPage)
    ],
    'goals' => [
        'sessions' => ['target' => $goalSessions, 'current' => intval($todayStats['todaySessions'])],
        'minutes'  => ['target' => $goalMinutes,  'current' => intval($todayStats['todayMinutes'])],
        'tasks'    => ['target' => $goalTasks,     'current' => $todayTaskCount]
    ]
]);