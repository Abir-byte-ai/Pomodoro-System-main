// ============================================
// Register Page JavaScript
// Time Management and Pomodoro Tracker
// ============================================

const registerForm          = document.getElementById('registerForm');
const nameInput             = document.getElementById('fullName');
const emailInput            = document.getElementById('email');
const passwordInput         = document.getElementById('password');
const confirmPasswordInput  = document.getElementById('confirmPassword');
const alertBox              = document.getElementById('alertBox');
const registerBtn           = document.querySelector('.register-btn');

// Email validation
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Show alert
function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert ${type} show`;
    setTimeout(() => alertBox.classList.remove('show'), 5000);
}

// Set button loading state
function setLoading(isLoading) {
    registerBtn.disabled    = isLoading;
    registerBtn.textContent = isLoading ? 'Creating Account...' : 'Create Account';
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 6)  strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password))   strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
}

// ---- Real-time field validation ----

nameInput.addEventListener('blur', function () {
    const nameError = document.getElementById('nameError');
    if (this.value !== '' && this.value.trim().length < 2) {
        this.classList.add('error');
        nameError.classList.add('show');
    } else if (this.value.trim().length >= 2) {
        this.classList.remove('error');
        this.classList.add('success');
        nameError.classList.remove('show');
    }
});

nameInput.addEventListener('input', function () {
    this.classList.remove('error', 'success');
    document.getElementById('nameError').classList.remove('show');
});

emailInput.addEventListener('blur', function () {
    const emailError   = document.getElementById('emailError');
    const emailSuccess = document.getElementById('emailSuccess');
    if (this.value !== '' && !validateEmail(this.value)) {
        this.classList.add('error');
        this.classList.remove('success');
        emailError.classList.add('show');
        emailSuccess.classList.remove('show');
    } else if (validateEmail(this.value)) {
        this.classList.remove('error');
        this.classList.add('success');
        emailError.classList.remove('show');
        emailSuccess.classList.add('show');
    }
});

emailInput.addEventListener('input', function () {
    this.classList.remove('error', 'success');
    document.getElementById('emailError').classList.remove('show');
    document.getElementById('emailSuccess').classList.remove('show');
});

// Password strength bar
passwordInput.addEventListener('input', function () {
    const password        = this.value;
    const strengthBar     = document.getElementById('strengthBar');
    const strengthText    = document.getElementById('strengthText');
    const passwordStrength = document.getElementById('passwordStrength');

    if (password.length > 0) {
        passwordStrength.classList.add('show');
        strengthText.classList.add('show');

        const strength = checkPasswordStrength(password);
        strengthBar.className = 'password-strength-bar';

        if (strength <= 2) {
            strengthBar.classList.add('strength-weak');
            strengthText.textContent = 'Weak password';
            strengthText.style.color = '#e74c3c';
        } else if (strength <= 4) {
            strengthBar.classList.add('strength-medium');
            strengthText.textContent = 'Medium strength';
            strengthText.style.color = '#f39c12';
        } else {
            strengthBar.classList.add('strength-strong');
            strengthText.textContent = 'Strong password';
            strengthText.style.color = '#27ae60';
        }
    } else {
        passwordStrength.classList.remove('show');
        strengthText.classList.remove('show');
    }

    this.classList.remove('error', 'success');
    document.getElementById('passwordError').classList.remove('show');
});

passwordInput.addEventListener('blur', function () {
    const passwordError = document.getElementById('passwordError');
    if (this.value !== '' && this.value.length < 6) {
        this.classList.add('error');
        passwordError.classList.add('show');
    } else if (this.value.length >= 6) {
        this.classList.add('success');
        passwordError.classList.remove('show');
    }
});

confirmPasswordInput.addEventListener('blur', function () {
    const confirmError   = document.getElementById('confirmError');
    const confirmSuccess = document.getElementById('confirmSuccess');
    if (this.value !== '' && this.value !== passwordInput.value) {
        this.classList.add('error');
        confirmError.classList.add('show');
        confirmSuccess.classList.remove('show');
    } else if (this.value !== '' && this.value === passwordInput.value) {
        this.classList.remove('error');
        this.classList.add('success');
        confirmError.classList.remove('show');
        confirmSuccess.classList.add('show');
    }
});

confirmPasswordInput.addEventListener('input', function () {
    this.classList.remove('error', 'success');
    document.getElementById('confirmError').classList.remove('show');
    document.getElementById('confirmSuccess').classList.remove('show');
});

// ---- Form submission ----

registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name            = nameInput.value.trim();
    const email           = emailInput.value.trim();
    const password        = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    let isValid           = true;

    // Validate all fields
    if (name.length < 2) {
        nameInput.classList.add('error');
        document.getElementById('nameError').classList.add('show');
        isValid = false;
    }

    if (!validateEmail(email)) {
        emailInput.classList.add('error');
        document.getElementById('emailError').classList.add('show');
        isValid = false;
    }

    if (password.length < 6) {
        passwordInput.classList.add('error');
        document.getElementById('passwordError').classList.add('show');
        isValid = false;
    }

    if (password !== confirmPassword) {
        confirmPasswordInput.classList.add('error');
        document.getElementById('confirmError').classList.add('show');
        isValid = false;
    }

    if (!isValid) {
        showAlert('Please fix the errors above.', 'alert-error');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('php/register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (result.success) {
            showAlert(result.message, 'alert-success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showAlert(result.message || 'Registration failed. Please try again.', 'alert-error');
            setLoading(false);
        }

    } catch (error) {
        console.error('Register error:', error);
        showAlert('Connection error. Please check your server and try again.', 'alert-error');
        setLoading(false);
    }
});

// ---- Password visibility toggles ----
document.getElementById('togglePassword')?.addEventListener('click', function () {
    const input  = document.getElementById('password');
    const isHidden = input.type === 'password';
    input.type       = isHidden ? 'text' : 'password';
    UIIcons.setPasswordToggle(this, isHidden);
});

document.getElementById('toggleConfirmPassword')?.addEventListener('click', function () {
    const input  = document.getElementById('confirmPassword');
    const isHidden = input.type === 'password';
    input.type       = isHidden ? 'text' : 'password';
    UIIcons.setPasswordToggle(this, isHidden);
});