// ============================================
// Email Verification Modal (post-registration)
// Time Management and Pomodoro Tracker
// ============================================

(function () {
    let pendingEmail    = '';
    let resendCooldown  = null;

    const modal         = document.getElementById('verifyModal');
    const verifyAlert   = document.getElementById('verifyAlert');

    function showAlert(msg, type) {
        verifyAlert.textContent = msg;
        verifyAlert.className   = `modal-alert show ${type}`;
    }
    function clearAlert() {
        verifyAlert.textContent = '';
        verifyAlert.className   = 'modal-alert';
    }

    // Called by register.js after successful registration response
    window.openVerifyModal = function (email) {
        pendingEmail = email;
        document.getElementById('verifyEmailDisplay').textContent = email;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        clearAlert();
        clearOtpInputs();
        setTimeout(() => {
            const first = document.querySelector('#verifyOtpInputs input');
            if (first) first.focus();
        }, 150);

        // Automatically send the OTP
        sendVerifyOtp(email);
    };

    async function sendVerifyOtp(email) {
        try {
            await fetch('php/send_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type: 'verify_email' })
            });
            startResendTimer();
        } catch {
            showAlert('Could not send verification email. Use Resend below.', 'error');
        }
    }

    // OTP input: auto-advance, backspace, paste
    const otpContainer = document.getElementById('verifyOtpInputs');
    const otpInputs    = Array.from(otpContainer.querySelectorAll('input'));

    otpInputs.forEach((inp, idx) => {
        inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/\D/g, '').slice(-1);
            if (inp.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
        });
        inp.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !inp.value && idx > 0) otpInputs[idx - 1].focus();
        });
        inp.addEventListener('paste', e => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
            pasted.split('').forEach((ch, i) => { if (otpInputs[idx + i]) otpInputs[idx + i].value = ch; });
            const next = Math.min(idx + pasted.length, otpInputs.length - 1);
            otpInputs[next].focus();
        });
    });

    function clearOtpInputs() { otpInputs.forEach(i => i.value = ''); }
    function getOtpValue()    { return otpInputs.map(i => i.value).join(''); }

    // Verify button
    document.getElementById('verifySubmitBtn').addEventListener('click', async () => {
        const otp = getOtpValue();
        if (otp.length !== 6) { showAlert('Please enter all 6 digits.', 'error'); return; }

        const btn = document.getElementById('verifySubmitBtn');
        btn.disabled    = true;
        btn.textContent = 'Verifying...';

        try {
            const res  = await fetch('php/verify_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail, token: otp, type: 'verify_email' })
            });
            const data = await res.json();

            if (data.success) {
                clearAlert();
                showAlert('✅ Email verified! Redirecting to login...', 'success');
                clearResendTimer();
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            } else {
                showAlert(data.message || 'Invalid code. Try again.', 'error');
                clearOtpInputs();
                otpInputs[0].focus();
            }
        } catch {
            showAlert('Connection error. Please try again.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Verify Email';
        }
    });

    // Resend
    document.getElementById('verifyResendLink').addEventListener('click', async () => {
        if (!pendingEmail) return;
        showAlert('Sending new code...', 'success');
        try {
            const res  = await fetch('php/send_otp.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail, type: 'verify_email' })
            });
            const data = await res.json();
            showAlert(data.success ? 'New code sent! Check your inbox.' : (data.message || 'Could not resend.'),
                      data.success ? 'success' : 'error');
            if (data.success) { clearOtpInputs(); otpInputs[0].focus(); startResendTimer(); }
        } catch {
            showAlert('Connection error.', 'error');
        }
    });

    function startResendTimer() {
        const link    = document.getElementById('verifyResendLink');
        const timerEl = document.getElementById('verifyResendTimer');
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
        const timerEl = document.getElementById('verifyResendTimer');
        if (timerEl) timerEl.textContent = '';
    }

})();
