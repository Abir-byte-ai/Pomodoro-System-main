// ============================================
// Profile Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

const AVATAR_COLORS = [
    '#667eea', '#764ba2', '#48bb78', '#38a169',
    '#f6ad55', '#ed8936', '#fc8181', '#e53e3e',
    '#63b3ed', '#3182ce', '#b794f4', '#805ad5',
    '#f687b3', '#d53f8c', '#4fd1c5', '#319795'
];

let selectedColor = null;
let currentColor  = null;

function showAlert(elId, msg, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className   = `profile-alert show ${type}`;
    setTimeout(() => { el.className = 'profile-alert'; }, 4000);
}

// Build colour swatches
function buildColorGrid(savedColor) {
    const grid = document.getElementById('colorGrid');
    if (!grid) return;
    grid.innerHTML = '';

    AVATAR_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (color === savedColor ? ' selected' : '');
        swatch.style.background = color;
        swatch.title = color;
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            selectedColor = color;
            // Live preview
            const preview = document.getElementById('previewAvatar');
            if (preview) preview.style.background = color;
            const sidebar = document.getElementById('sidebarAvatar');
            if (sidebar) sidebar.style.background = color;
        });
        grid.appendChild(swatch);
    });
}

// Load user info
async function loadProfile() {
    try {
        const response = await fetch('php/get_session.php');
        if (!response.ok) { window.location.href = 'login.html'; return; }
        const result = await response.json();
        if (!result.success) { window.location.href = 'login.html'; return; }

        const { userName, userEmail, avatarColor } = result.data;
        currentColor  = avatarColor || AVATAR_COLORS[0];
        selectedColor = currentColor;

        // Sidebar
        const sidebarName   = document.getElementById('sidebarName');
        const sidebarEmail  = document.getElementById('sidebarEmail');
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarName)   sidebarName.textContent  = userName;
        if (sidebarEmail)  sidebarEmail.textContent = userEmail;
        if (sidebarAvatar) {
            sidebarAvatar.textContent   = userName.charAt(0).toUpperCase();
            sidebarAvatar.style.background = currentColor;
        }

        // Preview avatar
        const preview = document.getElementById('previewAvatar');
        if (preview) {
            preview.textContent        = userName.charAt(0).toUpperCase();
            preview.style.background   = currentColor;
        }

        // Form
        const nameInput  = document.getElementById('displayName');
        const emailInput = document.getElementById('displayEmail');
        if (nameInput)  nameInput.value  = userName;
        if (emailInput) emailInput.value = userEmail;

        buildColorGrid(currentColor);

    } catch (err) {
        console.error('Profile load error:', err);
        window.location.href = 'login.html';
    }
}

// Save name
document.getElementById('saveNameBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('displayName');
    const newName   = nameInput.value.trim();

    if (newName.length < 2) {
        showAlert('nameAlert', 'Name must be at least 2 characters.', 'error');
        return;
    }

    const btn = document.getElementById('saveNameBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        const res  = await fetch('php/update_profile.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'update_name', name: newName })
        });
        const data = await res.json();

        if (data.success) {
            showAlert('nameAlert', '✅ Name updated successfully!', 'success');
            // Update sidebar & avatar initial
            const sidebarName = document.getElementById('sidebarName');
            if (sidebarName) sidebarName.textContent = newName;
            const sidebarAvatar = document.getElementById('sidebarAvatar');
            if (sidebarAvatar) sidebarAvatar.textContent = newName.charAt(0).toUpperCase();
            const preview = document.getElementById('previewAvatar');
            if (preview) preview.textContent = newName.charAt(0).toUpperCase();
        } else {
            showAlert('nameAlert', data.message || 'Failed to update name.', 'error');
        }
    } catch {
        showAlert('nameAlert', 'Connection error. Please try again.', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Changes';
    }
});

// Save avatar colour
document.getElementById('saveAvatarBtn')?.addEventListener('click', async () => {
    if (!selectedColor) {
        showAlert('avatarAlert', 'Please select a colour first.', 'error');
        return;
    }

    const btn = document.getElementById('saveAvatarBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        const res  = await fetch('php/update_profile.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action: 'update_avatar_color', color: selectedColor })
        });
        const data = await res.json();

        if (data.success) {
            currentColor = selectedColor;
            showAlert('avatarAlert', '✅ Avatar colour saved!', 'success');
        } else {
            showAlert('avatarAlert', data.message || 'Failed to save colour.', 'error');
        }
    } catch {
        showAlert('avatarAlert', 'Connection error. Please try again.', 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Colour';
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) window.location.href = 'php/logout.php';
});

document.addEventListener('DOMContentLoaded', loadProfile);
