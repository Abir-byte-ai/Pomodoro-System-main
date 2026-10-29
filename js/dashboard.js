// ============================================
// Dashboard JavaScript
// Time Management and Pomodoro Tracker
// ============================================

let overviewChartInstance = null;

function displayCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

async function loadUserInfo() {
    try {
        const response = await fetch('php/get_session.php');
        const result   = await safeJson(response, 'get_session');
        if (result && result.success) {
            const { userName, userEmail, avatarColor } = result.data;
            const nameEl   = document.querySelector('.user-name');
            const emailEl  = document.querySelector('.user-email');
            const avatarEl = document.querySelector('.user-avatar');
            if (nameEl)   nameEl.textContent  = userName;
            if (emailEl)  emailEl.textContent  = userEmail;
            if (avatarEl) {
                avatarEl.textContent = userName.charAt(0).toUpperCase();
                if (avatarColor) avatarEl.style.background = avatarColor;
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) { console.error('Failed to load user info:', error); }
}

async function safeJson(response, label) {
    const text = await response.text();
    try { return JSON.parse(text); }
    catch(e) { console.error(`[${label}] HTTP ${response.status} — raw:`, text.substring(0, 400)); return null; }
}

// If a request fails, replace the loading placeholders with a message
// (so nothing keeps pulsing and no stale numbers are shown).
function showLoadError(el, message) {
    if (el && el.querySelector('[aria-busy="true"]')) {
        el.innerHTML = '<p class="load-message">' + message + '</p>';
    }
}
function markStatsUnavailable() {
    ['sessionChange', 'taskChange'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent.trim() === 'Loading...') {
            el.textContent = "Couldn't load";
            el.className   = 'stat-change neutral';
        }
    });
}

async function loadDashboardStats() {
    try {
        const yesterday    = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // The three requests don't depend on each other, so send them together
        const [todayData, yestData, weekData] = await Promise.all([
            fetch('php/progress.php?period=daily').then(r => safeJson(r, 'progress daily')),
            fetch(`php/progress.php?startDate=${yesterdayStr}&endDate=${yesterdayStr}`).then(r => safeJson(r, 'progress yesterday')),
            fetch('php/progress.php?period=weekly').then(r => safeJson(r, 'progress weekly'))
        ]);

        if (todayData && todayData.success) {
            const today = todayData.data;
            const yest  = yestData && yestData.success ? yestData.data : null;
            const week  = weekData && weekData.success  ? weekData.data  : null;

            const todaySessions = today.goals.sessions.current;
            const yestSessions  = yest ? yest.summary.totalSessions : 0;
            animateCounter('todaySessions', todaySessions);
            updateChangeLabel('sessionChange', todaySessions - yestSessions, 'from yesterday', todaySessions === 0 && yestSessions === 0);

            const todayTasks = today.summary.completedTasks;
            const yestTasks  = yest ? yest.summary.completedTasks : 0;
            animateCounter('tasksCompleted', todayTasks);
            updateChangeLabel('taskChange', todayTasks - yestTasks, 'from yesterday', todayTasks === 0 && yestTasks === 0);

            const weekMinutes = week ? week.summary.focusMinutes : 0;
            animateCounter('totalMinutes', weekMinutes);
            const minutesLabel = document.getElementById('minutesLabel');
            if (minutesLabel) { minutesLabel.textContent = 'This week'; minutesLabel.className = 'stat-change neutral'; }

            await loadStreak();
        } else {
            markStatsUnavailable();
        }
    } catch (error) { console.error('Failed to load dashboard stats:', error); markStatsUnavailable(); }
}

function updateChangeLabel(elementId, diff, suffix, bothZero) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (bothZero) { el.textContent = 'No data yet'; el.className = 'stat-change neutral'; return; }
    if (diff > 0)      { el.textContent = `+${diff} ${suffix}`; el.className = 'stat-change positive'; }
    else if (diff < 0) { el.textContent = `${diff} ${suffix}`;  el.className = 'stat-change negative'; }
    else               { el.textContent = `Same as ${suffix.replace('from ', '')}`; el.className = 'stat-change neutral'; }
}

async function loadStreak() {
    try {
        const response = await fetch('php/progress.php?period=monthly&days=30');
        const result   = await safeJson(response, 'streak');
        if (result && result.success) {
            const chartData = result.data.chartData;
            let streak = 0;
            const today = new Date();
            for (let i = 0; i < 30; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() - i);
                const dateStr = checkDate.toISOString().split('T')[0];
                const found   = chartData.find(d => d.date === dateStr && parseInt(d.sessions) > 0);
                if (found) { streak++; } else if (i > 0) { break; }
            }
            animateCounter('currentStreak', streak);
            const streakLabel = document.getElementById('streakLabel');
            if (streakLabel) {
                streakLabel.textContent = streak > 0 ? `Day${streak > 1 ? 's' : ''} in a row! 🔥` : 'Start your streak today';
                streakLabel.className   = streak > 0 ? 'stat-change positive' : 'stat-change neutral';
            }
        }
    } catch (error) { console.error('Failed to load streak:', error); }
}

async function loadTodayTasks() {
    try {
        const response = await fetch('php/tasks.php?filter=all');
        const result   = await safeJson(response, 'tasks');
        const taskList = document.getElementById('todayTasksList');
        if (!result || !result.success) { showLoadError(taskList, "Couldn't load tasks. Refresh to try again."); return; }
        if (!taskList) return;
        const displayTasks = result.data.tasks.slice(0, 5);
        if (displayTasks.length === 0) {
            taskList.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">No tasks yet. Add one!</p>';
            return;
        }
        taskList.innerHTML = displayTasks.map(task => `
            <div class="task-item ${task.status === 'completed' ? 'completed' : ''}">
                <input type="checkbox" id="dash-task-${task.taskID}" class="task-checkbox"
                    ${task.status === 'completed' ? 'checked' : ''}
                    onchange="toggleTask(${task.taskID}, this.checked)">
                <label for="dash-task-${task.taskID}" class="task-label">
                    <span class="task-title">${escapeHtml(task.title)}</span>
                    <span class="task-priority ${task.priority}">${capitalize(task.priority)}</span>
                </label>
            </div>
        `).join('');
    } catch (error) { console.error('Failed to load tasks:', error); showLoadError(document.getElementById('todayTasksList'), "Couldn't load tasks. Refresh to try again."); }
}

async function toggleTask(taskId, isChecked) {
    try {
        await fetch('php/tasks.php', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, status: isChecked ? 'completed' : 'pending' })
        });
        loadDashboardStats(); loadTodayTasks();
    } catch (error) { console.error('Failed to toggle task:', error); }
}

async function loadRecentActivity() {
    try {
        const response = await fetch('php/progress.php?period=weekly&filter=all&page=1');
        const result   = await safeJson(response, 'activity');
        const activityList = document.querySelector('.activity-list');
        if (!result || !result.success) { showLoadError(activityList, "Couldn't load activity. Refresh to try again."); return; }
        const sessions     = result.data.sessions.list.slice(0, 4);
        if (!activityList) return;
        if (sessions.length === 0) {
            activityList.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">No activity yet. Start a Pomodoro session!</p>';
            return;
        }
        activityList.innerHTML = sessions.map(session => {
            const isWork  = session.type === 'work';
            const icon    = UIIcons.svg(isWork ? 'timer' : (session.type === 'shortBreak' ? 'coffee' : 'armchair'));
            const title   = isWork
                ? `Work Session${session.taskTitle ? ' - ' + escapeHtml(session.taskTitle) : ''}`
                : (session.type === 'shortBreak' ? 'Short Break' : 'Long Break');
            return `
                <div class="activity-item">
                    <div class="activity-icon ${isWork ? 'work' : 'break'}">${icon}</div>
                    <div class="activity-info">
                        <p class="activity-title">${title}</p>
                        <p class="activity-time">${formatTimeAgo(session.startTime)}</p>
                    </div>
                    ${isWork ? `<span class="activity-duration">${session.duration} min</span>` : ''}
                </div>`;
        }).join('');
    } catch (error) { console.error('Failed to load activity:', error); showLoadError(document.querySelector('.activity-list'), "Couldn't load activity. Refresh to try again."); }
}

// ---- Chart ----

async function loadOverviewChart(period = 'weekly') {
    try {
        const days     = period === 'monthly' ? 30 : 7;
        const response = await fetch(`php/progress.php?period=${period}&days=${days}`);
        const text     = await response.text();
        console.log('[progress.php chart] HTTP:', response.status, '| Raw:', text.substring(0, 300));
        const result   = JSON.parse(text);
        if (!result.success) { console.warn('[progress.php chart] success=false:', result.message); return; }
        const filledData = fillMissingDays(result.data.chartData, days);
        const labels     = filledData.map(d => formatChartLabel(d.date, period));
        const minutes    = filledData.map(d => parseInt(d.focusMinutes) || 0);
        const sessions   = filledData.map(d => parseInt(d.sessions) || 0);
        renderOverviewChart(labels, minutes, sessions, period);
    } catch (error) { console.error('[progress.php chart] Failed:', error); }
}

function fillMissingDays(chartData, days) {
    const result = [];
    const today  = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date    = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const found   = chartData.find(d => d.date === dateStr);
        result.push(found || { date: dateStr, focusMinutes: 0, sessions: 0 });
    }
    return result;
}

function formatChartLabel(dateStr, period) {
    const date = new Date(dateStr + 'T00:00:00');
    return period === 'weekly'
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

function renderOverviewChart(labels, minutes, sessions, period) {
    const canvas = document.getElementById('overviewLineChart');
    if (!canvas) return;

    const dark = getDarkMode();
    const gridColor   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor   = dark ? '#a0aec0' : '#718096';
    const legendColor = dark ? '#e2e8f0' : '#4a5568';
    const tooltipBg   = dark ? 'rgba(26,32,44,0.97)' : 'rgba(45,55,72,0.95)';

    if (overviewChartInstance) { overviewChartInstance.destroy(); overviewChartInstance = null; }

    overviewChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Focus Minutes', data: minutes,
                    borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.15)',
                    borderWidth: 3, fill: true, tension: 0.4, yAxisID: 'yMinutes',
                    pointBackgroundColor: '#667eea', pointBorderColor: dark ? '#2d3748' : '#fff',
                    pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8
                },
                {
                    label: 'Sessions', data: sessions,
                    borderColor: '#f6ad55', backgroundColor: 'rgba(246,173,85,0.1)',
                    borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'ySessions',
                    borderDash: [5,3], pointBackgroundColor: '#f6ad55', pointBorderColor: dark ? '#2d3748' : '#fff',
                    pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, font: { size: 13 }, color: legendColor, padding: 20 } },
                tooltip: {
                    backgroundColor: tooltipBg, padding: 12, cornerRadius: 8,
                    titleColor: '#e2e8f0', bodyColor: '#cbd5e0',
                    callbacks: {
                        label: function(ctx) {
                            if (ctx.dataset.yAxisID === 'yMinutes') {
                                const h = Math.floor(ctx.raw/60), m = ctx.raw%60;
                                return `  Focus Time: ${h>0?h+'h ':''}${m}m`;
                            }
                            return `  Sessions: ${ctx.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 12 } } },
                yMinutes: {
                    type: 'linear', position: 'left', min: 0,
                    grid: { color: gridColor },
                    ticks: { color: '#667eea', font: { size: 12 }, callback: val => val + ' min' }
                },
                ySessions: {
                    type: 'linear', position: 'right', min: 0,
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#f6ad55', font: { size: 12 }, stepSize: 1, callback: val => Number.isInteger(val) ? val : '' }
                }
            }
        }
    });
}

// ---- Helpers ----

function animateCounter(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const steps = 30, inc = targetValue / steps;
    let step = 0;
    const timer = setInterval(() => {
        step++;
        el.textContent = Math.min(Math.round(inc * step), targetValue);
        if (step >= steps) clearInterval(timer);
    }, 800 / steps);
}

function formatTimeAgo(dateTimeStr) {
    const diffMin  = Math.floor((new Date() - new Date(dateTimeStr)) / 60000);
    const diffHrs  = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffMin < 1)    return 'Just now';
    if (diffMin < 60)   return `${diffMin} minute${diffMin>1?'s':''} ago`;
    if (diffHrs < 24)   return `${diffHrs} hour${diffHrs>1?'s':''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

const style = document.createElement('style');
style.textContent = `.stat-change.negative { color: #fc8181; }`;
document.head.appendChild(style);

// ---- All init inside DOMContentLoaded ----
document.addEventListener('DOMContentLoaded', async function () {
    displayCurrentDate();
    // These loads don't depend on each other: start them all at once instead of one after another.
    // (Each one handles its own errors.) The buttons below are wired immediately, not after the loads.
    Promise.all([loadUserInfo(), loadDashboardStats(), loadTodayTasks(), loadRecentActivity()]);

    // Chart period buttons — must be inside DOMContentLoaded so they exist
    document.querySelectorAll('.overview-period-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.overview-period-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            loadOverviewChart(this.dataset.period);
        });
    });

    // Load chart with a small delay so canvas has rendered dimensions
    setTimeout(() => loadOverviewChart('weekly'), 100);

    // Other buttons
    document.getElementById('startTimerBtn')?.addEventListener('click', () => {
        window.location.href = 'timer.html';
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) window.location.href = 'php/logout.php';
    });
});

// Auto-refresh every 5 minutes
setInterval(() => { loadDashboardStats(); loadRecentActivity(); loadTodayTasks(); }, 300000);