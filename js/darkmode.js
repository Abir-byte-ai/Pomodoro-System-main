// ============================================
// Dark Mode
// Time Management and Pomodoro Tracker
// ============================================

// Apply saved theme immediately to avoid flash
(function () {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark-mode');
    }
})();

// Lucide icon + label for the theme toggle (falls back to text only if icons.js is missing)
function themeToggleHtml(isDark) {
    const icon = window.UIIcons ? UIIcons.svg(isDark ? 'sun' : 'moon') : '';
    return icon + (isDark ? 'Light Mode' : 'Dark Mode');
}

document.addEventListener('DOMContentLoaded', function () {
    // Don't add twice
    if (document.getElementById('darkModeToggle')) return;

    const btn = document.createElement('button');
    btn.id        = 'darkModeToggle';
    btn.className = 'dark-mode-toggle';
    btn.style.cssText = `
        width:100%; padding:10px 16px; margin-bottom:8px;
        border:none; border-radius:8px;
        font-size:13px; font-weight:600; cursor:pointer;
        text-align:left; transition:background 0.2s;
    `;
    // The button shows what clicking it will switch TO (sun = go light, moon = go dark)
    btn.innerHTML = themeToggleHtml(document.documentElement.classList.contains('dark-mode'));

    btn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark-mode');
        btn.innerHTML = themeToggleHtml(isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        refreshChartsForDarkMode();
    });

    // Insert before logout button; fall back to sidebar-footer or sidebar
    const logoutBtn     = document.getElementById('logoutBtn');
    const sidebarFooter = document.querySelector('.sidebar-footer') || document.querySelector('.sidebar');

    if (logoutBtn && logoutBtn.parentNode) {
        logoutBtn.parentNode.insertBefore(btn, logoutBtn);
    } else if (sidebarFooter) {
        sidebarFooter.appendChild(btn);
    }
});

// Re-renders charts on the current page after a theme toggle
function refreshChartsForDarkMode() {
    // Dashboard line chart
    if (typeof loadOverviewChart === 'function') {
        const activePeriodBtn = document.querySelector('.overview-period-btn.active');
        const period = activePeriodBtn ? activePeriodBtn.dataset.period : 'weekly';
        loadOverviewChart(period);
    }
    // Report bar chart
    if (typeof fetchReport === 'function') {
        const start = document.getElementById('startDate')?.value;
        const end   = document.getElementById('endDate')?.value;
        if (start && end) fetchReport(start, end);
    }
    // Progress pie chart
    if (typeof loadProgressData === 'function') {
        loadProgressData(1);
    }
}