// ============================================
// Timer Page JavaScript
// Time Management and Pomodoro Tracker
// v3: max limits, 30s state save, dark mode
// ============================================

// Timer limits
const LIMITS = { work: 60, shortBreak: 15, longBreak: 30 };

let timerState = {
    mode:              'work',
    duration:          25 * 60,
    remaining:         25 * 60,
    isRunning:         false,
    isPaused:          false,
    intervalId:        null,
    saveIntervalId:    null,
    sessionsCompleted: 0,
    sessionStartTime:  null
};

const timerDisplay      = document.getElementById('timerDisplay');
const timerLabel        = document.getElementById('timerLabel');
const timerProgress     = document.getElementById('timerProgress');
const startBtn          = document.getElementById('startBtn');
const pauseBtn          = document.getElementById('pauseBtn');
const resetBtn          = document.getElementById('resetBtn');
const sessionsTodayEl   = document.getElementById('sessionsToday');
const currentTaskEl     = document.getElementById('currentTask');
const selectTask        = document.getElementById('selectTask');

const workDurationInput       = document.getElementById('workDuration');
const shortBreakDurationInput = document.getElementById('shortBreakDuration');
const longBreakDurationInput  = document.getElementById('longBreakDuration');
const autoStartBreaks         = document.getElementById('autoStartBreaks');
const soundEnabledInput       = document.getElementById('soundEnabled');

// Enforce max limits on the inputs
workDurationInput.max       = LIMITS.work;
shortBreakDurationInput.max = LIMITS.shortBreak;
longBreakDurationInput.max  = LIMITS.longBreak;

function clampInput(input, max) {
    input.addEventListener('change', () => {
        let val = parseInt(input.value) || 1;
        if (val > max) { val = max; input.value = max; }
        if (val < 1)   { val = 1;   input.value = 1;   }
    });
}
clampInput(workDurationInput,       LIMITS.work);
clampInput(shortBreakDurationInput, LIMITS.shortBreak);
clampInput(longBreakDurationInput,  LIMITS.longBreak);

const circumference = 2 * Math.PI * 160;
timerProgress.style.strokeDasharray = circumference;

const modeLabels = { 'work': 'Focus Time', 'short-break': 'Short Break', 'long-break': 'Long Break' };

async function loadUserInfo() {
    try {
        const response = await fetch('php/get_session.php');
        const result   = await response.json();
        if (result.success) {
            const { userName, userEmail, avatarColor } = result.data;
            const nameEl   = document.querySelector('.user-name');
            const emailEl  = document.querySelector('.user-email');
            const avatarEl = document.querySelector('.user-avatar');
            if (nameEl)   nameEl.textContent  = userName;
            if (emailEl)  emailEl.textContent = userEmail;
            if (avatarEl) {
                avatarEl.textContent = userName.charAt(0).toUpperCase();
                if (avatarColor) avatarEl.style.background = avatarColor;
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (err) { console.error('Session error:', err); }
}

async function loadTasksDropdown() {
    try {
        const response = await fetch('php/tasks.php?filter=pending');
        const result   = await response.json();
        if (result.success && result.data.tasks.length > 0) {
            selectTask.innerHTML = '<option value="">Select a task...</option>';
            result.data.tasks.forEach(task => {
                const option   = document.createElement('option');
                option.value   = task.taskID;
                option.textContent = task.title;
                selectTask.appendChild(option);
            });
        } else if (result.success) {
            // Nothing pending: say so instead of leaving an unusable "Select a task..."
            selectTask.options[0].textContent = 'No pending tasks';
        }
    } catch (error) { console.error('Failed to load tasks:', error); }
}

async function loadTodaySessions() {
    try {
        const response = await fetch('php/progress.php?period=daily');
        const result   = await response.json();
        if (result.success) {
            const count = result.data.goals.sessions.current;
            timerState.sessionsCompleted = count;
            if (sessionsTodayEl) sessionsTodayEl.textContent = count;
        }
    } catch (error) { console.error('Failed to load today sessions:', error); }
}

function updateDisplay() {
    const minutes = Math.floor(timerState.remaining / 60);
    const seconds = timerState.remaining % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    const progress = timerState.remaining / timerState.duration;
    timerProgress.style.strokeDashoffset = circumference - (progress * circumference);
    document.title = `${timerDisplay.textContent} - Pomodoro Timer`;
    timerLabel.textContent = modeLabels[timerState.mode];
}

// 30-second periodic state save
async function saveTimerState() {
    if (!timerState.isRunning) return;
    try {
        await fetch('php/save_timer_state.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                remainingTime: timerState.remaining,
                duration:      Math.floor(timerState.duration / 60),
                isRunning:     timerState.isRunning
            })
        });
    } catch (e) { /* silent fail — state save is best-effort */ }
}

function startPeriodicSave() {
    if (timerState.saveIntervalId) return;
    timerState.saveIntervalId = setInterval(saveTimerState, 30000);
}

function stopPeriodicSave() {
    if (timerState.saveIntervalId) {
        clearInterval(timerState.saveIntervalId);
        timerState.saveIntervalId = null;
    }
}

function startTimer() {
    if (timerState.isRunning) return;
    timerState.isRunning        = true;
    timerState.isPaused         = false;
    timerState.sessionStartTime = timerState.sessionStartTime || new Date().toISOString();

    startBtn.style.display = 'none';
    pauseBtn.style.display = 'flex';
    document.body.classList.add('timer-running');
    document.body.classList.remove('timer-paused');

    startPeriodicSave();

    timerState.intervalId = setInterval(() => {
        if (timerState.remaining > 0) {
            timerState.remaining--;
            updateDisplay();
        } else {
            completeSession();
        }
    }, 1000);
}

function pauseTimer() {
    if (!timerState.isRunning) return;
    timerState.isRunning = false;
    timerState.isPaused  = true;
    clearInterval(timerState.intervalId);
    stopPeriodicSave();
    startBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
    document.body.classList.remove('timer-running');
    document.body.classList.add('timer-paused');
}

function resetTimer() {
    pauseTimer();
    timerState.remaining        = timerState.duration;
    timerState.isPaused         = false;
    timerState.sessionStartTime = null;
    updateDisplay();
    document.body.classList.remove('timer-running', 'timer-paused');
    document.title = 'Pomodoro Timer - Time Management & Pomodoro Tracker';
}

async function completeSession() {
    pauseTimer();
    if (soundEnabledInput.checked) playNotification();

    const endTime   = new Date().toISOString();
    const startTime = timerState.sessionStartTime || endTime;
    const taskId    = selectTask.value ? parseInt(selectTask.value) : null;
    const typeMap   = { 'work': 'work', 'short-break': 'shortBreak', 'long-break': 'longBreak' };

    try {
        const response = await fetch('php/timer_save.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                taskId,
                duration:  Math.floor(timerState.duration / 60),
                type:      typeMap[timerState.mode],
                startTime,
                endTime
            })
        });
        const result = await response.json();
        if (result.success && timerState.mode === 'work') {
            timerState.sessionsCompleted = result.data.sessionsToday;
            if (sessionsTodayEl) sessionsTodayEl.textContent = result.data.sessionsToday;
        }
    } catch (error) { console.error('Failed to save session:', error); }

    timerState.sessionStartTime = null;

    if (timerState.mode === 'work') {
        alert('🎉 Pomodoro complete! Time for a break.');
        if (autoStartBreaks.checked) {
            const breakMode = timerState.sessionsCompleted % 4 === 0 ? 'long-break' : 'short-break';
            switchMode(breakMode);
            setTimeout(startTimer, 2000);
        }
    } else {
        alert('Break over! Ready to focus?');
        if (autoStartBreaks.checked) { switchMode('work'); setTimeout(startTimer, 2000); }
    }
}

function playNotification() {
    try {
        const ctx        = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gain       = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 800;
        oscillator.type            = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.6);
    } catch (e) { console.warn('Audio not available:', e); }
}

function switchMode(mode) {
    pauseTimer();
    timerState.mode             = mode;
    timerState.sessionStartTime = null;
    let minutes;
    const maxWork  = LIMITS.work;
    const maxShort = LIMITS.shortBreak;
    const maxLong  = LIMITS.longBreak;
    if (mode === 'work') {
        minutes = Math.min(parseInt(workDurationInput.value) || 25, maxWork);
    } else if (mode === 'short-break') {
        minutes = Math.min(parseInt(shortBreakDurationInput.value) || 5, maxShort);
    } else {
        minutes = Math.min(parseInt(longBreakDurationInput.value) || 15, maxLong);
    }
    timerState.duration  = minutes * 60;
    timerState.remaining = timerState.duration;
    updateDisplay();
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

selectTask.addEventListener('change', function () {
    const selected = this.options[this.selectedIndex];
    if (currentTaskEl) currentTaskEl.textContent = this.value ? selected.text : 'No task selected';
});

workDurationInput.addEventListener('change', () => {
    if (timerState.mode === 'work' && !timerState.isRunning) {
        const val = Math.min(parseInt(workDurationInput.value) || 25, LIMITS.work);
        workDurationInput.value  = val;
        timerState.duration      = val * 60;
        timerState.remaining     = timerState.duration;
        updateDisplay();
    }
});
shortBreakDurationInput.addEventListener('change', () => {
    if (timerState.mode === 'short-break' && !timerState.isRunning) {
        const val = Math.min(parseInt(shortBreakDurationInput.value) || 5, LIMITS.shortBreak);
        shortBreakDurationInput.value = val;
        timerState.duration           = val * 60;
        timerState.remaining          = timerState.duration;
        updateDisplay();
    }
});
longBreakDurationInput.addEventListener('change', () => {
    if (timerState.mode === 'long-break' && !timerState.isRunning) {
        const val = Math.min(parseInt(longBreakDurationInput.value) || 15, LIMITS.longBreak);
        longBreakDurationInput.value = val;
        timerState.duration          = val * 60;
        timerState.remaining         = timerState.duration;
        updateDisplay();
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (timerState.isRunning) {
        if (!confirm('Timer is running. Are you sure you want to logout?')) return;
    }
    window.location.href = 'php/logout.php';
});

window.addEventListener('beforeunload', (e) => {
    if (timerState.isRunning) { e.preventDefault(); e.returnValue = 'Timer is running. Are you sure?'; }
});

async function initTimer() {
    await loadUserInfo();
    await loadTasksDropdown();
    await loadTodaySessions();
    updateDisplay();
}
document.addEventListener('DOMContentLoaded', initTimer);
