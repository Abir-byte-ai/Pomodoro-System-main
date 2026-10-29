// ============================================
// Tasks Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

let currentFilter = 'all';
let editingTaskId = null;
let allTasks      = [];

function displayCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

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
            if (emailEl)  emailEl.textContent  = userEmail;
            if (avatarEl) {
                avatarEl.textContent = userName.charAt(0).toUpperCase();
                if (avatarColor) avatarEl.style.background = avatarColor;
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (err) { console.error('Session error:', err); }
}

function buildFetchUrl() {
    const startDate = document.getElementById('taskStartDate')?.value;
    const endDate   = document.getElementById('taskEndDate')?.value;
    let url = `php/tasks.php?filter=${currentFilter}`;
    if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
    return url;
}

// If loading fails, replace the loading placeholders so nothing keeps pulsing
function showTasksLoadError() {
    const container = document.getElementById('tasksList');
    if (container && container.querySelector('[aria-busy="true"]')) {
        container.innerHTML = '<p class="load-message">Couldn\'t load your tasks. Refresh to try again.</p>';
    }
}

async function fetchTasks() {
    try {
        const response = await fetch(buildFetchUrl());
        const result   = await response.json();
        if (result.success) {
            allTasks = result.data.tasks;
            renderTasks(allTasks);
            updateSummary(result.data.summary);
            updateResultsBadge(result.data.filters);
        } else {
            console.error('Failed to fetch tasks:', result.message);
            showTasksLoadError();
        }
    } catch (error) {
        console.error('Fetch tasks error:', error);
        showTasksLoadError();
    }
}

function updateResultsBadge(filters) {
    const badge = document.getElementById('filterResultsBadge');
    if (!badge) return;
    const hasDateRange = filters.startDate && filters.endDate;
    if (hasDateRange) {
        badge.textContent   = `${filters.count} task${filters.count !== 1 ? 's' : ''} found`;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderTasks(tasks) {
    const container  = document.getElementById('tasksList');
    const emptyState = document.getElementById('emptyState');
    if (!container) return;

    if (tasks.length === 0) {
        container.style.display  = 'none';
        container.innerHTML      = '';   // drop the loading placeholders
        emptyState.style.display = 'block';
        return;
    }

    container.style.display  = 'grid';
    emptyState.style.display = 'none';

    container.innerHTML = tasks.map(task => `
        <div class="task-card ${task.status === 'completed' ? 'completed' : ''}"
             data-task-id="${task.taskID}" data-status="${task.status}">
            <div class="task-card-header">
                <input type="checkbox" class="task-checkbox"
                    ${task.status === 'completed' ? 'checked' : ''}
                    onchange="toggleTaskStatus(${task.taskID}, this.checked)">
                <h3 class="task-card-title">${escapeHtml(task.title)}</h3>
                <span class="task-priority-badge ${task.priority}">${formatPriority(task.priority)}</span>
            </div>
            <p class="task-description">${escapeHtml(task.description || '')}</p>
            <div class="task-card-footer">
                <span class="task-date">
                    ${task.status === 'completed'
                        ? UIIcons.svg('circle-check') + ' Completed: ' + formatDate(task.completedAt)
                        : task.deadline
                            ? UIIcons.svg('calendar-days') + ' Due: ' + formatDate(task.deadline)
                            : UIIcons.svg('calendar-days') + ' No deadline'}
                </span>
                <div class="task-actions">
                    <button type="button" class="task-action-btn edit"   onclick="openEditModal(${task.taskID})" title="Edit"
                            aria-label="Edit task: ${escapeAttr(task.title)}">${UIIcons.svg('pencil')}</button>
                    <button type="button" class="task-action-btn delete" onclick="deleteTask(${task.taskID})"    title="Delete"
                            aria-label="Delete task: ${escapeAttr(task.title)}">${UIIcons.svg('trash-2')}</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateSummary(summary) {
    const totalEl     = document.getElementById('totalTasks');
    const pendingEl   = document.getElementById('pendingTasks');
    const completedEl = document.getElementById('completedTasks');
    if (totalEl)     totalEl.textContent     = summary.total     || 0;
    if (pendingEl)   pendingEl.textContent   = summary.pending   || 0;
    if (completedEl) completedEl.textContent = summary.completed || 0;
}

async function toggleTaskStatus(taskId, isChecked) {
    try {
        const response = await fetch('php/tasks.php', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ taskId, status: isChecked ? 'completed' : 'pending' })
        });
        const result = await response.json();
        if (result.success) { fetchTasks(); }
        else { alert('Failed to update task: ' + result.message); }
    } catch (error) { console.error('Toggle task error:', error); }
}

function openEditModal(taskId) {
    const task = allTasks.find(t => t.taskID == taskId);
    if (!task) return;
    editingTaskId = taskId;
    document.getElementById('modalTitle').textContent        = 'Edit Task';
    document.getElementById('taskId').value                  = task.taskID;
    document.getElementById('taskTitle').value               = task.title;
    document.getElementById('taskDescription').value         = task.description || '';
    document.getElementById('taskPriority').value            = task.priority;
    document.getElementById('taskDeadline').value            = task.deadline || '';
    document.getElementById('taskModal').classList.add('show');
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const response = await fetch(`php/tasks.php?taskId=${taskId}`, { method: 'DELETE' });
        const result   = await response.json();
        if (result.success) { fetchTasks(); }
        else { alert('Failed to delete task: ' + result.message); }
    } catch (error) { console.error('Delete task error:', error); }
}

function formatPriority(p) {
    return { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' }[p] || p;
}
function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Same as escapeHtml but also safe inside a double-quoted HTML attribute
function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

// ---- All event listeners inside DOMContentLoaded ----
document.addEventListener('DOMContentLoaded', async function () {
    displayCurrentDate();
    await loadUserInfo();
    await fetchTasks();

    const taskModal  = document.getElementById('taskModal');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn  = document.getElementById('cancelBtn');
    const taskForm   = document.getElementById('taskForm');

    // Open add modal
    addTaskBtn?.addEventListener('click', () => {
        editingTaskId = null;
        document.getElementById('modalTitle').textContent = 'Add New Task';
        taskForm.reset();
        taskModal.classList.add('show');
    });

    // Close modal
    closeModal?.addEventListener('click', () => taskModal.classList.remove('show'));
    cancelBtn?.addEventListener('click',  () => taskModal.classList.remove('show'));
    taskModal?.addEventListener('click',  (e) => { if (e.target === taskModal) taskModal.classList.remove('show'); });

    // Form submit
    taskForm?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const payload = {
            title:       document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            priority:    document.getElementById('taskPriority').value,
            deadline:    document.getElementById('taskDeadline').value || null
        };
        if (!payload.title) { alert('Task title is required.'); return; }

        const submitBtn       = taskForm.querySelector('[type="submit"]');
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Saving...';

        try {
            const response = await fetch('php/tasks.php', {
                method:  editingTaskId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(editingTaskId ? { taskId: editingTaskId, ...payload } : payload)
            });
            const result = await response.json();
            if (result.success) {
                taskModal.classList.remove('show');
                fetchTasks();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Save task error:', error);
            alert('Connection error. Please try again.');
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Save Task';
        }
    });

    // Filter tabs — must be inside DOMContentLoaded so tabs exist in DOM
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            fetchTasks();
        });
    });

    // Date range filter
    document.getElementById('applyTaskDateRange')?.addEventListener('click', () => {
        const start = document.getElementById('taskStartDate')?.value;
        const end   = document.getElementById('taskEndDate')?.value;
        if (!start || !end) { alert('Please select both start and end dates.'); return; }
        if (new Date(start) > new Date(end)) { alert('Start date cannot be after end date.'); return; }
        fetchTasks();
    });

    document.getElementById('clearTaskDateRange')?.addEventListener('click', () => {
        const startEl = document.getElementById('taskStartDate');
        const endEl   = document.getElementById('taskEndDate');
        if (startEl) startEl.value = '';
        if (endEl)   endEl.value   = '';
        const badge = document.getElementById('filterResultsBadge');
        if (badge) badge.style.display = 'none';
        fetchTasks();
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) window.location.href = 'php/logout.php';
    });
});