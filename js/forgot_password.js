// ============================================
// Forgot Password Modal
// Time Management and Pomodoro Tracker
// 3 steps: email → verify OTP → new password
// ============================================

(function () {
    let currentEmail     = '';
    let resendCooldown   = null;

    const modal          = document.getElementById('forgotModal');
    const modalAlert     = document.getElementById('modalAlert');
    const modalTitle     = document.getElementById('modalTitle');
    const modalSubtitle  = document.getElementById('modalSubtitle');

    const steps = {
        1: document.getElementById('fpStep1'),
        2: document.getElementById('fpStep2'),
        3: document.getElementById('fpStep3'),
    };
    const dots = [
        document.getElementById('dot1'),
        document.getElementById('dot2'),
        document.getElementById('dot3'),
    ];

    function showAlert(msg, type) {
        modalAlert.textContent = msg;
        modalAlert.className   = `modal-alert show ${type}`;
    }
    function clearAlert() {
        modalAlert.textContent = '';
        modalAlert.className   = 'modal-alert';
    }

    function goToStep(n) {
        Object.values(steps).forEach(s => s.classList.remove('active'));
        steps[n].classList.add('active');
        dots.forEach((d, i) => d.classList.toggle('done', i < n));
        clearAlert();

        if (n === 1) {
            modalTitle.textContent    = 'Forgot Password';
            modalSubtitle.textContent = 'Enter your email to receive a reset code';
        } else if (n === 2) {
            modalTitle.textContent    = 'Enter Reset Code';
            modalSubtitle.textContent = 'Check your inbox (and spam folder)';
            focusFirstOtpInput();
        } else if (n === 3) {
            modalTitle.textContent    = 'Set New Password';
            modalSubtitle.textContent = 'Choose a strong password';
        }
    }

    function openModal() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        goToStep(1);
        document.getElementById('fpEmail').value = '';
        clearOtpInputs();
        document.getElementById('fpNewPassword').value     = '';
        document.getElementById('fpConfirmPassword').value = '';
    }
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        clearResendTimer();
    }

    // ---- Step 1: Send OTP ----

    document.getElementById('forgotPasswordLink').addEventListener('click', e => {
        e.preventDefault();
        openModal();
    });
    document.getElementById('fpCancelBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    document.getElementById('fpSendBtn').addEventListener('click', async () => {
        const email = document.getElementById('fpEmail').value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('Please enter a valid email address.', 'error');
            return;
        }
        const btn = document.getElementById('fpSendBtn');
        btn.disabled     = true;
        btn.textContent  = 'Sending...';

        try {
            const res  = await fetch('php/send_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type: 'reset_password' })
            });
            const data = await res.json();

            if (data.success) {
                currentEmail = email;
                document.getElementById('fpEmailDisplay').textContent = email;
                goToStep(2);
                startResendTimer();
            } else {
                showAlert(data.message || 'Could not send code. Try again.', 'error');
            }
        } catch {
            showAlert('Connection error. Please try again.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Send Reset Code';
        }
    });

    // ---- Step 2: Verify OTP ----

    // Auto-advance OTP boxes + backspace support
    function setupOtpInputs(containerId) {
        const container = document.getElementById(containerId);
        const inputs    = Array.from(container.querySelectorAll('input'));

        inputs.forEach((inp, idx) => {
            inp.addEventListener('input', () => {
                inp.value = inp.value.replace(/\D/g, '').slice(-1);
                if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
            });
            inp.addEventListener('paste', e => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                pasted.split('').forEach((ch, i) => {
                    if (inputs[idx + i]) inputs[idx + i].value = ch;
                });
                const next = Math.min(idx + pasted.length, inputs.length - 1);
                inputs[next].focus();
            });
        });
    }

    setupOtpInputs('fpOtpInputs');

    function focusFirstOtpInput() {
        const first = document.querySelector('#fpOtpInputs input');
        if (first) setTimeout(() => first.focus(), 100);
    }

    function clearOtpInputs() {
        document.querySelectorAll('#fpOtpInputs input').forEach(i => i.value = '');
    }

    function getOtpValue() {
        return Array.from(document.querySelectorAll('#fpOtpInputs input')).map(i => i.value).join('');
    }

    document.getElementById('fpVerifyBtn').addEventListener('click', async () => {
        const otp = getOtpValue();
        if (otp.length !== 6) { showAlert('Please enter all 6 digits.', 'error'); return; }

        const btn = document.getElementById('fpVerifyBtn');
        btn.disabled    = true;
        btn.textContent = 'Verifying...';

        try {
            const res  = await fetch('php/verify_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, token: otp, type: 'reset_password' })
            });
            const data = await res.json();

            if (data.success) {
                clearResendTimer();
                goToStep(3);
                document.getElementById('fpNewPassword').focus();
            } else {
                showAlert(data.message || 'Invalid code. Try again.', 'error');
                clearOtpInputs();
                focusFirstOtpInput();
            }
        } catch {
            showAlert('Connection error. Please try again.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Verify Code';
        }
    });

    document.getElementById('fpBackToStep1').addEventListener('click', () => {
        clearResendTimer();
        goToStep(1);
    });

    // Resend timer (60s cooldown)
    function startResendTimer() {
        const link    = document.getElementById('fpResendLink');
        const timerEl = document.getElementById('fpResendTimer');
        let secs = 60;

        link.classList.add('disabled');
        timerEl.textContent = ` (${secs}s)`;

        clearResendTimer();
        resendCooldown = setInterval(() => {
            secs--;
            if (secs <= 0) {
                clearResendTimer();
                link.classList.remove('disabled');
                timerEl.textContent = '';
            } else {
                timerEl.textContent = ` (${secs}s)`;
            }
        }, 1000);
    }

    function clearResendTimer() {
        if (resendCooldown) { clearInterval(resendCooldown); resendCooldown = null; }
        const timerEl = document.getElementById('fpResendTimer');
        if (timerEl) timerEl.textContent = '';
        const link = document.getElementById('fpResendLink');
        if (link) link.classList.remove('disabled');
    }

    document.getElementById('fpResendLink').addEventListener('click', async () => {
        if (!currentEmail) return;
        try {
            const res  = await fetch('php/send_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, type: 'reset_password' })
            });
            const data = await res.json();
            showAlert(data.success ? 'New code sent!' : (data.message || 'Could not resend.'),
                      data.success ? 'success' : 'error');
            if (data.success) { clearOtpInputs(); focusFirstOtpInput(); startResendTimer(); }
        } catch {
            showAlert('Connection error.', 'error');
        }
    });

    // ---- Step 3: New password ----

    const fpNewPw     = document.getElementById('fpNewPassword');
    const fpPwFill    = document.getElementById('fpPwFill');
    const fpPwHint    = document.getElementById('fpPwHint');

    fpNewPw.addEventListener('input', () => {
        const v = fpNewPw.value;
        let strength = 0;
        if (v.length >= 6)  strength++;
        if (v.length >= 10) strength++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) strength++;
        if (/\d/.test(v))   strength++;
        if (/[^a-zA-Z\d]/.test(v)) strength++;

        const pct    = Math.min(strength * 20, 100);
        const colors = ['', '#fc8181', '#f6ad55', '#68d391', '#48bb78', '#38a169'];
        const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
        fpPwFill.style.width      = pct + '%';
        fpPwFill.style.background = colors[strength] || '';
        fpPwHint.textContent      = v.length > 0 ? labels[strength] : '';
    });

    document.getElementById('fpTogglePw').addEventListener('click', function () {
        const isHidden   = fpNewPw.type === 'password';
        fpNewPw.type     = isHidden ? 'text' : 'password';
        this.textContent = isHidden ? '🙈' : '👁';
    });

    document.getElementById('fpResetBtn').addEventListener('click', async () => {
        const newPw  = document.getElementById('fpNewPassword').value;
        const confPw = document.getElementById('fpConfirmPassword').value;

        if (newPw.length < 6) {
            showAlert('Password must be at least 6 characters.', 'error'); return;
        }
        if (newPw !== confPw) {
            showAlert('Passwords do not match.', 'error'); return;
        }

        const btn = document.getElementById('fpResetBtn');
        btn.disabled    = true;
        btn.textContent = 'Saving...';

        try {
            const res  = await fetch('php/reset_password.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: newPw })
            });
            const data = await res.json();

            if (data.success) {
                showAlert('✅ ' + data.message, 'success');
                setTimeout(() => {
                    closeModal();
                    // Pre-fill email on login form for convenience
                    const loginEmail = document.getElementById('email');
                    if (loginEmail && currentEmail) loginEmail.value = currentEmail;
                }, 2000);
            } else {
                showAlert(data.message || 'Could not reset password. Please try again.', 'error');
            }
        } catch {
            showAlert('Connection error. Please try again.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Set New Password';
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

})();