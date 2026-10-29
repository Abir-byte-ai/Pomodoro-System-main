// ============================================
// Login Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

const loginForm     = document.getElementById('loginForm');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const alertBox      = document.getElementById('alertBox');
const loginBtn      = document.querySelector('.login-btn');

// Email validation
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Show alert message
function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert ${type} show`;
    setTimeout(() => alertBox.classList.remove('show'), 5000);
}

// Set button loading state
function setLoading(isLoading) {
    loginBtn.disabled    = isLoading;
    loginBtn.textContent = isLoading ? 'Logging in...' : 'Login';
}

// Real-time email validation on blur
emailInput.addEventListener('blur', function () {
    if (this.value !== '' && !validateEmail(this.value)) {
        this.classList.add('error');
        emailError.classList.add('show');
    } else {
        this.classList.remove('error');
        emailError.classList.remove('show');
    }
});

// Real-time password validation on blur
passwordInput.addEventListener('blur', function () {
    if (this.value !== '' && this.value.length < 6) {
        this.classList.add('error');
        passwordError.classList.add('show');
    } else {
        this.classList.remove('error');
        passwordError.classList.remove('show');
    }
});

// Clear errors on typing
emailInput.addEventListener('input', function () {
    this.classList.remove('error');
    emailError.classList.remove('show');
});

passwordInput.addEventListener('input', function () {
    this.classList.remove('error');
    passwordError.classList.remove('show');
});

// Form submission
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;
    let isValid    = true;

    // Client-side validation first
    if (!validateEmail(email)) {
        emailInput.classList.add('error');
        emailError.classList.add('show');
        isValid = false;
    }

    if (password.length < 6) {
        passwordInput.classList.add('error');
        passwordError.classList.add('show');
        isValid = false;
    }

    if (!isValid) {
        showAlert('Please fix the errors above.', 'alert-error');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('php/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            showAlert(result.message, 'alert-success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showAlert(result.message || 'Login failed. Please try again.', 'alert-error');
            setLoading(false);
        }

    } catch (error) {
        console.error('Login error:', error);
        showAlert('Connection error. Please check your server and try again.', 'alert-error');
        setLoading(false);
    }
});

// ---- Password visibility toggle ----
document.getElementById('togglePassword')?.addEventListener('click', function () {
    const input = document.getElementById('password');
    const isHidden = input.type === 'password';
    input.type      = isHidden ? 'text' : 'password';
    UIIcons.setPasswordToggle(this, isHidden);
});