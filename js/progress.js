// ============================================
// Progress Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

let currentPeriod = 'weekly';
let currentPage   = 1;
let totalPages    = 1;
let pieChartInstance = null;

// Display current date
function displayCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
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

// Build API URL — supports both period presets and custom date range
function buildApiUrl(page = 1) {
    const startDate = document.getElementById('progressStartDate')?.value;
    const endDate   = document.getElementById('progressEndDate')?.value;
    const filter    = getSessionFilter();

    if (startDate && endDate) {
        return `php/progress.php?startDate=${startDate}&endDate=${endDate}&filter=${filter}&page=${page}`;
    }

    const days = getDaysForPeriod(currentPeriod);
    return `php/progress.php?period=${currentPeriod}&days=${days}&filter=${filter}&page=${page}`;
}

// If loading fails, replace the loading placeholders so nothing keeps pulsing
function showProgressLoadError(page) {
    if (page !== 1) return;
    ['sessionChangeLabel', 'taskChangeLabel', 'avgChangeLabel'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent.trim() === 'Loading...') { el.textContent = "Couldn't load"; el.className = 'stat-change neutral'; }
    });
    const list = document.getElementById('sessionList');
    if (list && list.querySelector('[aria-busy="true"]')) list.innerHTML = '<p class="load-message">Couldn\'t load sessions. Refresh to try again.</p>';
    const grid = document.querySelector('.goals-grid');
    if (grid && grid.querySelector('[aria-busy="true"]')) grid.innerHTML = '<p class="load-message">Couldn\'t load goals. Refresh to try again.</p>';
}

// Load all progress data
async function loadProgressData(page = 1) {
    try {
        const url      = buildApiUrl(page);
        const response = await fetch(url);
        const text     = await response.text();
        let result;
        try { result = JSON.parse(text); }
        catch(e) { console.error('[progress.php] HTTP', response.status, '— raw:', text.substring(0,400)); showProgressLoadError(page); return; }

        if (!result.success) { console.warn('[progress.php] success=false:', result.message); showProgressLoadError(page); return; }

        const { summary, pieData, chartData, sessions, goals } = result.data;

        updateStats(summary);
        renderPieChart(pieData);
        renderSessions(sessions.list, page);
        updateGoals(goals);

        totalPages  = sessions.pages;
        currentPage = page;

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
        }

    } catch (error) {
        console.error('Failed to load progress data:', error);
        showProgressLoadError(page);
    }
}

// Update stat cards
function updateStats(summary) {
    const map = {
        totalSessions:  summary.totalSessions,
        completedTasks: summary.completedTasks,
        focusTime:      summary.focusMinutes,
        dailyAverage:   summary.dailyAverage
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) animateCounter(el, val);
    });

    // Fetch previous period to compute real comparison labels
    const days = getDaysForPeriod(currentPeriod);
    const prevEnd   = new Date(); prevEnd.setDate(prevEnd.getDate() - days);
    const prevStart = new Date(prevEnd);  prevStart.setDate(prevStart.getDate() - days + 1);
    const fmt = d => d.toISOString().split('T')[0];

    fetch(`php/progress.php?startDate=${fmt(prevStart)}&endDate=${fmt(prevEnd)}`)
        .then(r => r.json())
        .then(prev => {
            if (!prev.success) return;
            const p = prev.data.summary;

            function changeLabel(current, previous, unit = '') {
                if (previous === 0) return current > 0 ? `New this period` : `No data yet`;
                const pct  = Math.round(((current - previous) / previous) * 100);
                const sign = pct >= 0 ? '+' : '';
                const periodName = currentPeriod === 'daily' ? 'yesterday' : currentPeriod === 'monthly' ? 'last month' : 'last week';
                return `${sign}${pct}%${unit} from ${periodName}`;
            }

            function setLabel(id, text, positive) {
                const el = document.getElementById(id);
                if (!el) return;
                el.textContent = text;
                el.className = 'stat-change ' + (positive ? 'positive' : positive === false ? 'negative' : 'neutral');
            }

            const sessChange = summary.totalSessions - p.totalSessions;
            setLabel('sessionChangeLabel', changeLabel(summary.totalSessions, p.totalSessions), sessChange >= 0);

            const taskChange = summary.completedTasks - p.completedTasks;
            setLabel('taskChangeLabel', changeLabel(summary.completedTasks, p.completedTasks), taskChange >= 0);

            const avgChange = summary.dailyAverage - p.dailyAverage;
            setLabel('avgChangeLabel', summary.dailyAverage + ' min / day avg', avgChange >= 0 ? true : avgChange < 0 ? false : null);
        })
        .catch(() => {}); // silently ignore if prev period fetch fails
}

// ---- Pie Chart ----
function renderPieChart(pieData) {
    const canvas = document.getElementById('productivityPieChart');
    if (!canvas) return;

    const workEntry       = pieData.find(d => d.type === 'work')       || { minutes: 0, percentage: 0 };
    const shortBreakEntry = pieData.find(d => d.type === 'shortBreak') || { minutes: 0, percentage: 0 };
    const longBreakEntry  = pieData.find(d => d.type === 'longBreak')  || { minutes: 0, percentage: 0 };

    const total = workEntry.minutes + shortBreakEntry.minutes + longBreakEntry.minutes;

    // Show empty state message if no data
    const emptyMsg = document.getElementById('pieEmptyMsg');
    if (total === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (pieChartInstance) { pieChartInstance.destroy(); pieChartInstance = null; }
        canvas.style.display = 'none';
        updatePieLegend(0, 0, 0, 0, 0, 0);
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    canvas.style.display = 'block';

    const labels = [
        `Focus Time (${workEntry.percentage}%)`,
        `Short Break (${shortBreakEntry.percentage}%)`,
        `Long Break (${longBreakEntry.percentage}%)`
    ];

    const data = [workEntry.minutes, shortBreakEntry.minutes, longBreakEntry.minutes];

    // Destroy existing chart before re-rendering
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    pieChartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#667eea', '#f6ad55', '#fc8181'],
                borderColor:     ['#5a6fd6', '#ed9432', '#f56565'],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding:   20,
                        font:      { size: 13 },
                        color:     document.documentElement.classList.contains('dark-mode') ? '#e2e8f0' : '#4a5568',
                        usePointStyle: true,
                        pointStyleWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark-mode') ? 'rgba(26,32,44,0.97)' : 'rgba(45,55,72,0.95)',
                    titleColor: '#e2e8f0',
                    bodyColor:  '#cbd5e0',
                    callbacks: {
                        label: function(context) {
                            const mins  = context.raw;
                            const hrs   = Math.floor(mins / 60);
                            const rem   = mins % 60;
                            const pct   = pieData[context.dataIndex]?.percentage ?? 0;
                            const timeStr = hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
                            return ` ${timeStr} (${pct}%)`;
                        }
                    }
                },
                datalabels: { display: false }
            }
        }
    });

    // Update custom legend stats below chart
    updatePieLegend(
        workEntry.minutes,       workEntry.percentage,
        shortBreakEntry.minutes, shortBreakEntry.percentage,
        longBreakEntry.minutes,  longBreakEntry.percentage
    );
}

// Update the stat boxes below the pie chart
function updatePieLegend(workMin, workPct, shortMin, shortPct, longMin, longPct) {
    function fmt(min) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    const items = [
        { id: 'pieWorkTime',   time: fmt(workMin),  pct: workPct  },
        { id: 'pieShortTime',  time: fmt(shortMin), pct: shortPct },
        { id: 'pieLongTime',   time: fmt(longMin),  pct: longPct  }
    ];

    items.forEach(item => {
        const timeEl = document.getElementById(item.id + 'Val');
        const pctEl  = document.getElementById(item.id + 'Pct');
        if (timeEl) timeEl.textContent = item.time;
        if (pctEl)  pctEl.textContent  = item.pct + '%';
    });
}

// Render session history list
function renderSessions(sessions, page) {
    const list = document.getElementById('sessionList');
    if (!list) return;

    const typeConfig = {
        work:       { icon: 'timer',    cls: 'work',  label: 'Work Session'  },
        shortBreak: { icon: 'coffee',   cls: 'break', label: 'Short Break'   },
        longBreak:  { icon: 'armchair', cls: 'break', label: 'Long Break'    }
    };

    const newItems = sessions.map(session => {
        const config = typeConfig[session.type] || typeConfig.work;
        const title  = session.type === 'work' && session.taskTitle
            ? `${config.label} - ${escapeHtml(session.taskTitle)}`
            : config.label;

        return `
            <div class="session-item ${config.cls}">
                <div class="session-icon">${UIIcons.svg(config.icon)}</div>
                <div class="session-info">
                    <p class="session-title">${title}</p>
                    <p class="session-time">${formatDateTime(session.startTime)}</p>
                </div>
                <div class="session-duration">${session.duration} min</div>
            </div>
        `;
    }).join('');

    if (page === 1) {
        list.innerHTML = newItems || '<p style="text-align:center;color:#718096;padding:20px;">No sessions recorded yet.</p>';
    } else {
        list.innerHTML += newItems;
    }
}

// Update daily goals
function updateGoals(goals) {
    const goalsGrid = document.querySelector('.goals-grid');
    if (!goalsGrid) return;

    // Use user's saved goals from localStorage, override PHP defaults
    const saved = loadSavedGoals();

    const items = [
        { label: 'Sessions Goal',   current: goals.sessions.current, target: saved.sessions, unit: ''    },
        { label: 'Focus Time Goal', current: goals.minutes.current,  target: saved.minutes,  unit: ' min' },
        { label: 'Tasks Completed', current: goals.tasks.current,    target: saved.tasks,    unit: ''    }
    ];

    goalsGrid.innerHTML = items.map(item => {
        const pct  = Math.min(Math.round((item.current / item.target) * 100), 100);
        const done = item.current >= item.target;
        const rem  = item.target - item.current;

        return `
            <div class="goal-item ${done ? 'completed' : ''}">
                <div class="goal-header">
                    <span class="goal-label">${item.label}</span>
                    <span class="goal-value">${item.current}/${item.target}${item.unit}${done ? ' ' + UIIcons.svg('check') : ''}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${done ? 'success' : ''}" style="width:${pct}%"></div>
                </div>
                <p class="goal-status ${done ? 'success' : ''}">
                    ${done ? 'Goal achieved! 🎉' : `${rem}${item.unit} remaining`}
                </p>
            </div>
        `;
    }).join('');
}

// ---- Event listeners ----

// Period selector buttons
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentPeriod = this.dataset.period;
        currentPage   = 1;

        // Clear custom date range when using preset buttons
        const startEl = document.getElementById('progressStartDate');
        const endEl   = document.getElementById('progressEndDate');
        if (startEl) startEl.value = '';
        if (endEl)   endEl.value   = '';

        loadProgressData(1);
    });
});

// Apply custom date range
document.getElementById('applyDateRange')?.addEventListener('click', () => {
    const start = document.getElementById('progressStartDate')?.value;
    const end   = document.getElementById('progressEndDate')?.value;

    if (!start || !end) {
        alert('Please select both start and end dates.');
        return;
    }
    if (new Date(start) > new Date(end)) {
        alert('Start date cannot be after end date.');
        return;
    }

    // Deactivate period buttons when using custom range
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    currentPage = 1;
    loadProgressData(1);
});

// Session filter
document.getElementById('sessionFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadProgressData(1);
});

// Load more sessions
document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
        loadProgressData(currentPage + 1);
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'php/logout.php';
    }
});

// ---- Helpers ----

function getDaysForPeriod(period) {
    return period === 'daily' ? 1 : period === 'monthly' ? 30 : 7;
}

function getSessionFilter() {
    return document.getElementById('sessionFilter')?.value || 'all';
}

function animateCounter(el, target) {
    let current = 0;
    const steps = 25;
    const inc   = target / steps;
    let step    = 0;
    const timer = setInterval(() => {
        step++;
        current = Math.min(Math.round(inc * step), target);
        el.textContent = current;
        if (step >= steps) clearInterval(timer);
    }, 600 / steps);
}

function formatDateTime(dateStr) {
    const date      = new Date(dateStr);
    const now       = new Date();
    const isToday   = date.toDateString() === now.toDateString();
    const isYest    = new Date(now - 86400000).toDateString() === date.toDateString();
    const timeStr   = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isYest)  return `Yesterday at ${timeStr}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize
async function initProgressPage() {
    displayCurrentDate();
    await loadUserInfo();
    await loadProgressData(1);
}

document.addEventListener('DOMContentLoaded', initProgressPage);

// Goals Modal Logic

const GOALS_KEY = 'pomodoroUserGoals';

// Load saved goals from localStorage
function loadSavedGoals() {
    try {
        const saved = localStorage.getItem(GOALS_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { sessions: 10, minutes: 300, tasks: 5 };
}

// Save goals to localStorage
function saveGoals(goals) {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

// Open the goals modal and pre-fill with current saved values
document.getElementById('editGoalsBtn')?.addEventListener('click', () => {
    const saved = loadSavedGoals();
    document.getElementById('goalSessions').value = saved.sessions;
    document.getElementById('goalMinutes').value  = saved.minutes;
    document.getElementById('goalTasks').value    = saved.tasks;

    // Highlight matching preset if any
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.sessions) === saved.sessions &&
            parseInt(btn.dataset.minutes)  === saved.minutes) {
            btn.classList.add('active');
        }
    });

    document.getElementById('goalsModal').classList.add('show');
});

// Close modal
document.getElementById('closeGoalsModal')?.addEventListener('click', () => {
    document.getElementById('goalsModal').classList.remove('show');
});

document.getElementById('cancelGoalsBtn')?.addEventListener('click', () => {
    document.getElementById('goalsModal').classList.remove('show');
});

document.getElementById('goalsModal')?.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
});

// Save goals and refresh the goals section
document.getElementById('saveGoalsBtn')?.addEventListener('click', () => {
    const sessions = parseInt(document.getElementById('goalSessions').value);
    const minutes  = parseInt(document.getElementById('goalMinutes').value);
    const tasks    = parseInt(document.getElementById('goalTasks').value);

    // Validate
    if (!sessions || sessions < 1 || sessions > 50) {
        alert('Sessions goal must be between 1 and 50.');
        return;
    }
    if (!minutes || minutes < 10 || minutes > 720) {
        alert('Focus time goal must be between 10 and 720 minutes.');
        return;
    }
    if (!tasks || tasks < 1 || tasks > 50) {
        alert('Tasks goal must be between 1 and 50.');
        return;
    }

    saveGoals({ sessions, minutes, tasks });

    document.getElementById('goalsModal').classList.remove('show');

    // Refresh the progress data to reflect new goals
    loadProgressData(1);

    showGoalsToast('✅ Goals saved successfully!');
});

// Apply a quick preset
function applyPreset(btn) {
    document.getElementById('goalSessions').value = btn.dataset.sessions;
    document.getElementById('goalMinutes').value  = btn.dataset.minutes;
    document.getElementById('goalTasks').value    = btn.dataset.tasks;

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// Show a toast notification
function showGoalsToast(message) {
    let toast = document.getElementById('goalsToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id        = 'goalsToast';
        toast.className = 'goals-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}