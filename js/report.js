// ============================================
// Report Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

let weekChartInstance = null;

function displayCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function setDefaultDateRange() {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    document.getElementById('endDate').valueAsDate   = end;
    document.getElementById('startDate').valueAsDate = start;
}

// Load user info into sidebar
async function loadUserInfo() {
    try {
        const response = await fetch('php/get_session.php');
        const result   = await response.json();
        if (result.success) {
            const { userName, userEmail } = result.data;
            const nameEl   = document.querySelector('.user-name');
            const emailEl  = document.querySelector('.user-email');
            const avatarEl = document.querySelector('.user-avatar');
            if (nameEl)   nameEl.textContent  = userName;
            if (emailEl)  emailEl.textContent  = userEmail;
            if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();
            if (result.data.avatarColor) avatarEl.style.background = result.data.avatarColor;
        } else {
            window.location.href = 'login.html';
        }
    } catch (err) { console.error('Session error:', err); }
}

// Fetch report from PHP
async function fetchReport(startDate, endDate) {
    const generateBtn        = document.getElementById('generateReportBtn');
    generateBtn.innerHTML    = UIIcons.svg('loader-circle', 'ui-icon--spin') + ' Generating...';
    generateBtn.disabled     = true;

    try {
        const response = await fetch(`php/report.php?startDate=${startDate}&endDate=${endDate}`);
        const text = await response.text();

        console.log('[report.php] HTTP status:', response.status);
        console.log('[report.php] Raw response:', text);

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            showReportError(`PHP error (HTTP ${response.status}). Raw output logged to console (F12). First 200 chars: ${text.substring(0,200)}`);
            return;
        }

        if (!result.success) {
            showReportError('Report error: ' + result.message);
            return;
        }

        const { summary, comparison, currentWeek, weekRange, taskPerformance } = result.data;
        updateSummaryCards(summary, comparison);
        updateCurrentWeekChart(currentWeek, weekRange);
        updateTaskPerformance(taskPerformance);
        updateInsights(summary, comparison, currentWeek);

    } catch (error) {
        console.error('[report.php] Fetch failed:', error);
        showReportError('Connection error: ' + error.message + '. Is XAMPP running?');
    } finally {
        generateBtn.innerHTML = UIIcons.svg('chart-column') + ' Generate Report';
        generateBtn.disabled  = false;
    }
}

// Replace the loading placeholders so nothing keeps pulsing after a failed report
function clearReportPlaceholders() {
    [document.querySelector('.performance-grid'), document.querySelector('.insights-list')].forEach(el => {
        if (el && el.querySelector('[aria-busy="true"]')) el.innerHTML = '<p class="load-message">Report data isn\'t available right now.</p>';
    });
}

function showReportError(msg) {
    clearReportPlaceholders();
    // Show inline error — don't use alert()
    const canvas = document.getElementById('weekBarChart');
    if (canvas) {
        const container = canvas.parentElement;
        if (container) {
            container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a0aec0;font-size:14px;text-align:center;padding:20px;"><span class="report-error">${UIIcons.svg('triangle-alert')}<span>${msg}</span></span></div>`;
        }
    }
}

// Update the 4 summary cards with real comparison labels
function updateSummaryCards(summary, comparison) {

    // Add this at the top to show the actual date range
    const start   = document.getElementById('startDate').value;
    const end     = document.getElementById('endDate').value;
    const fmt     = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const rangeLabel = `${fmt(start)} – ${fmt(end)}`;

    // Sessions
    const sessionsEl = document.getElementById('reportSessions');
    if (sessionsEl) animateCounter(sessionsEl, summary.totalSessions);
    const sessionsSubEl = document.getElementById('sessionsPeriod');
    if (sessionsSubEl) sessionsSubEl.textContent = rangeLabel; // ← add this

    // Focus time
    const focusEl = document.getElementById('reportFocusTime');
    if (focusEl) {
        const hrs = Math.floor(summary.totalMinutes / 60);
        const min = summary.totalMinutes % 60;
        focusEl.textContent = `${hrs}h ${String(min).padStart(2, '0')}m`;
    }
    const focusSubEl = document.getElementById('focusPeriod');
    if (focusSubEl) focusSubEl.textContent = `${summary.totalMinutes} minutes`; // ← add this

    // Tasks
    const tasksEl = document.getElementById('reportTasks');
    if (tasksEl) animateCounter(tasksEl, summary.completedTasks);
    updateComparisonLabel('tasksPeriod', comparison.taskChange, comparison.hasPrevData, 'vs prev period');

    // Score
    const scoreEl = document.getElementById('reportScore');
    if (scoreEl) scoreEl.textContent = summary.productivityScore + '%';
    updateComparisonLabel('scorePeriod', comparison.scoreChange, comparison.hasPrevData, 'vs prev period');
}

// Set the comparison label
function updateComparisonLabel(elementId, changeVal, hasPrevData, suffix) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (!hasPrevData) {
        el.textContent = 'No previous data';
        el.className   = 'summary-period';
        return;
    }

    if (changeVal > 0) {
        el.textContent = `+${changeVal}% ${suffix}`;
        el.className   = 'summary-period success';
    } else if (changeVal < 0) {
        el.textContent = `${changeVal}% ${suffix}`;
        el.className   = 'summary-period negative';
    } else {
        el.textContent = `No change ${suffix}`;
        el.className   = 'summary-period';
    }
}

// Render current week bar chart using Chart.js
function updateCurrentWeekChart(weekData, weekRange) {
    const canvas = document.getElementById('weekBarChart');
    if (!canvas) return;

    // Build full Mon-Sun with 0s for missing days
    const allDays    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dataMap    = {};
    weekData.forEach(d => { dataMap[d.dayName] = parseInt(d.focusMinutes); });

    const labels  = shortDays;
    const minutes = allDays.map(d => dataMap[d] || 0);

    // Find best day for highlight
    const maxVal  = Math.max(...minutes, 1);
    const colors  = minutes.map(v =>
        v === maxVal && v > 0
            ? 'rgba(72, 187, 120, 0.85)'
            : 'rgba(102, 126, 234, 0.75)'
    );
    const borders = minutes.map(v =>
        v === maxVal && v > 0 ? '#38a169' : '#5a6fd6'
    );

    // Best day badge
    const bestDayIndex = minutes.indexOf(maxVal);
    const badge        = document.querySelector('.info-badge');
    if (badge) {
        badge.textContent = maxVal > 0
            ? `Most productive: ${allDays[bestDayIndex]}`
            : 'No data this week yet';
    }

    const subtitle = document.getElementById('weekRangeLabel');
    if (subtitle && weekRange) {
        const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        subtitle.textContent = `${fmt(weekRange.start)} – ${fmt(weekRange.end)}`;
    }

    if (weekChartInstance) {
        weekChartInstance.destroy();
        weekChartInstance = null;
    }

    const dark       = document.documentElement.classList.contains('dark-mode');
    const gridColor  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor  = dark ? '#a0aec0' : '#718096';
    const tooltipBg  = dark ? 'rgba(26,32,44,0.97)' : 'rgba(45, 55, 72, 0.95)';

    weekChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label:           'Focus Minutes',
                data:            minutes,
                backgroundColor: colors,
                borderColor:     borders,
                borderWidth:     2,
                borderRadius:    8,
                borderSkipped:   false
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: '#e2e8f0',
                    bodyColor:  '#cbd5e0',
                    padding:         12,
                    cornerRadius:    8,
                    callbacks: {
                        label: function(ctx) {
                            const mins = ctx.raw;
                            if (mins === 0) return '  No sessions';
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            return `  ${h > 0 ? h + 'h ' : ''}${m}m focus time`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid:  { display: false },
                    ticks: { color: tickColor, font: { size: 13, weight: '500' } }
                },
                y: {
                    beginAtZero: true,
                    grid:        { color: gridColor },
                    ticks: {
                        color:    tickColor,
                        font:     { size: 12 },
                        callback: val => val + ' min'
                    }
                }
            }
        }
    });
}

// Update task performance section
function updateTaskPerformance(tasks) {
    const grid = document.querySelector('.performance-grid');
    if (!grid) return;

    if (tasks.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#718096;padding:30px;">No task data for this period.</p>';
        return;
    }

    grid.innerHTML = tasks.map(task => `
        <div class="performance-item">
            <div class="performance-header">
                <h4>${escapeHtml(task.title)}</h4>
                <span class="badge ${task.priority}">${capitalize(task.priority)} Priority</span>
            </div>
            <div class="performance-stats">
                <div class="stat">
                    <span class="stat-label">Sessions:</span>
                    <span class="stat-value">${task.sessions}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Time:</span>
                    <span class="stat-value">${task.totalMinutes} min</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Status:</span>
                    <span class="stat-value ${task.status === 'completed' ? 'status-completed' : 'status-pending'}">
                        ${task.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

// Generate dynamic insights
function updateInsights(summary, comparison, weekData) {
    const list = document.querySelector('.insights-list');
    if (!list) return;

    const insights = [];

    if (summary.totalSessions === 0) {
        insights.push({
            type: 'info', icon: 'lightbulb', title: 'Get Started',
            text: 'No sessions recorded in this period. Start a Pomodoro timer to begin tracking!'
        });
    } else {
        insights.push({
            type: 'positive', icon: 'sparkles', title: 'Sessions Completed',
            text: `You completed ${summary.totalSessions} Pomodoro sessions — ${summary.totalMinutes} minutes of focused work.`
        });

        if (comparison.hasPrevData) {
            if (comparison.sessionChange > 0) {
                insights.push({
                    type: 'positive', icon: 'trending-up', title: 'Improvement!',
                    text: `You did ${comparison.sessionChange}% more sessions than the previous period. Great momentum!`
                });
            } else if (comparison.sessionChange < 0) {
                insights.push({
                    type: 'warning', icon: 'triangle-alert', title: 'Dip in Activity',
                    text: `Sessions dropped by ${Math.abs(comparison.sessionChange)}% compared to the previous period. Try to stay consistent.`
                });
            }
        }

        if (summary.productivityScore >= 70) {
            insights.push({
                type: 'positive', icon: 'target', title: 'Strong Consistency',
                text: `Your productivity score is ${summary.productivityScore}%. You've been working on most days — keep it up!`
            });
        } else {
            insights.push({
                type: 'warning', icon: 'calendar-days', title: 'Consistency Tip',
                text: `Your productivity score is ${summary.productivityScore}%. Try to study a little every day rather than cramming.`
            });
        }

        if (summary.completedTasks > 0) {
            insights.push({
                type: 'positive', icon: 'circle-check', title: 'Tasks Done',
                text: `You completed ${summary.completedTasks} task${summary.completedTasks > 1 ? 's' : ''} during this period.`
            });
        }
    }

    list.innerHTML = insights.map(ins => `
        <div class="insight-item ${ins.type}">
            <div class="insight-icon">${UIIcons.svg(ins.icon)}</div>
            <div class="insight-content">
                <h4>${ins.title}</h4>
                <p>${ins.text}</p>
            </div>
        </div>
    `).join('');
}

// Export CSV
function exportToCSV() {
    const rows  = [['Task', 'Priority', 'Sessions', 'Time (min)', 'Status']];
    const items = document.querySelectorAll('.performance-item');
    items.forEach(item => {
        const title    = item.querySelector('h4')?.textContent || '';
        const priority = item.querySelector('.badge')?.textContent || '';
        const stats    = item.querySelectorAll('.stat-value');
        rows.push([title, priority, stats[0]?.textContent || '0', stats[1]?.textContent?.replace(' min','') || '0', stats[2]?.textContent?.trim() || '']);
    });
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `report_${document.getElementById('startDate').value}_to_${document.getElementById('endDate').value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Animate counter
function animateCounter(el, target) {
    let step = 0;
    const steps = 30;
    const inc   = target / steps;
    const timer = setInterval(() => {
        step++;
        el.textContent = Math.min(Math.round(inc * step), target);
        if (step >= steps) clearInterval(timer);
    }, 600 / steps);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// Event listeners
document.getElementById('applyPeriodBtn')?.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end   = document.getElementById('endDate').value;
    if (!start || !end) { alert('Please select both dates.'); return; }
    if (new Date(start) > new Date(end)) { alert('Start date cannot be after end date.'); return; }
    fetchReport(start, end);
});

document.getElementById('generateReportBtn')?.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end   = document.getElementById('endDate').value;
    if (start && end) fetchReport(start, end);
    else alert('Please select a date range first.');
});

document.getElementById('exportReportBtn')?.addEventListener('click', exportToCSV);

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) window.location.href = 'php/logout.php';
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportToCSV();
    }
});

// Add negative color style
const style = document.createElement('style');
style.textContent = `.summary-period.negative { color: #fc8181; font-weight: 600; }`;
document.head.appendChild(style);

// Initialize
async function initReportPage() {
    displayCurrentDate();
    await loadUserInfo();
    setDefaultDateRange();
    const start = document.getElementById('startDate').value;
    const end   = document.getElementById('endDate').value;
    if (start && end) fetchReport(start, end);
}

document.addEventListener('DOMContentLoaded', initReportPage);