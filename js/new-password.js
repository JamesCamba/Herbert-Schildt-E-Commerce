// New Password functionality
document.addEventListener('DOMContentLoaded', function () {
    const passwordForm = document.getElementById('passwordForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const passwordStrength = document.getElementById('passwordStrength');
    const passwordMatch = document.getElementById('passwordMatch');

    // ✅ Email saved during OTP verification (still needed for context)
    const emailOTP = JSON.parse(localStorage.getItem("emailOTP"));

    // If no email in OTP, block page
    if (!emailOTP?.email) {
        showError("No verification found. Please restart password reset.");
        setTimeout(() => window.location.href = "forgot.html", 2000);
        return;
    }

    // Toggle password visibility
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    toggleConfirmPassword.addEventListener('click', function () {
        const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
        confirmPasswordInput.type = type;
        this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    // Password strength validation
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        updatePasswordStrength(strength);
        checkFormValidity();
    });

    confirmPasswordInput.addEventListener('input', function () {
        checkPasswordMatch();
        checkFormValidity();
    });

    // Check password strength
    function checkPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

        if (score <= 2) return { level: 'weak' };
        if (score <= 4) return { level: 'medium' };
        return { level: 'strong' };
    }

    function updatePasswordStrength(strength) {
        passwordStrength.textContent = `Password strength: ${strength.level}`;
        passwordStrength.className = `password-strength ${strength.level}`;
    }

    function checkPasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword === '') {
            passwordMatch.textContent = '';
        } else if (password === confirmPassword) {
            passwordMatch.textContent = '✓ Passwords match';
            passwordMatch.className = 'password-match match';
        } else {
            passwordMatch.textContent = '✗ Passwords do not match';
            passwordMatch.className = 'password-match no-match';
        }
    }

    function checkFormValidity() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const isValid = password.length >= 8 && password === confirmPassword;

        changePasswordBtn.disabled = !isValid;
        changePasswordBtn.classList.toggle('enabled', isValid);
    }

    // ✅ Handle form submission (update password in DB only)
    passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailOTP.email,   // comes from OTP process
                    password: password       // send to backend
                })
            });

            const result = await response.json();

            if (!result.success) {
                showError(result.message || 'Failed to update password in database.');
                return;
            }

            // ✅ Password changed successfully
            showSuccess('Password changed successfully!');
            localStorage.removeItem("emailOTP"); // clear OTP, cannot reuse

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);

        } catch (err) {
            console.error(err);
            showError('Error connecting to server. Please try again later.');
        }
    });

    // Notifications
    function showError(msg) { showNotification(msg, "error"); }
    function showSuccess(msg) { showNotification(msg, "success"); }
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
});
