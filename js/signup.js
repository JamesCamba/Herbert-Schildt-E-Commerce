document.addEventListener("DOMContentLoaded", function () {
    emailjs.init("-xbRzNSapSs8iD-WK"); // ✅ Initialize EmailJS once

    // Elements
    const signupForm = document.getElementById("signupForm");
    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const otpInput = document.getElementById("otpInput");
    const agreeCheckbox = document.getElementById("agree");
    const sendBtn = document.getElementById("send-OTP");

    // OTP config
    const OTP_STORAGE_KEY = "OTPsign";
    const OTP_DURATION = 5 * 60; // 5 minutes
    let timerInterval = null;

    // Helpers
    function generateOTP() {
        return Math.floor(10000 + Math.random() * 90000); // 5-digit OTP
    }

    function startTimer(duration) {
        let remaining = duration;
        sendBtn.disabled = true;

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            sendBtn.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
            remaining--;

            if (remaining < 0) {
                clearInterval(timerInterval);
                sendBtn.textContent = "Resend OTP";
                sendBtn.disabled = false;
                localStorage.removeItem(OTP_STORAGE_KEY);
            }
        }, 1000);
    }

    async function sendOTP() {
        const email = emailInput.value.trim();
        if (!email) {
            alert("Please enter your email first.");
            return;
        }

        // Check if email already exists
        try {
            const res = await fetch("https://herbert-schildt-e-commerce-31.onrender.com/get-users");
            const users = await res.json();
            const emailExists = users.some(u => (u.Email || "").toLowerCase() === email.toLowerCase());

            if (emailExists) {
                alert("This email is already registered. Please use another email.");
                return;
            }
        } catch (err) {
            console.error("Error checking existing emails:", err);
            alert("Could not verify email. Try again later.");
            return;
        }

        // Remove old OTP if any
        localStorage.removeItem(OTP_STORAGE_KEY);

        const otp = generateOTP();
        localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ email, pin: otp }));
        console.log("📨 OTP stored in localStorage:", otp);

        try {
            await emailjs.send("service_b816d9f", "template_1yu5htt", {
                to_email: email,
                to_name: email,
                otp_code: otp
            });
            console.log("✅ OTP sent via email!");
            alert("OTP has been sent to your email.");
        } catch (err) {
            console.error("❌ Failed to send OTP", err);
            alert("Failed to send OTP. Try again.");
            return;
        }

        startTimer(OTP_DURATION);
    }

    sendBtn.addEventListener("click", sendOTP);

    // Email validation
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Notification system
    function showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 2rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1001',
            animation: 'slideIn 0.3s ease-out',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        };

        if (type === 'error') styles.background = '#dc3545';
        else if (type === 'success') styles.background = '#28a745';
        else styles.background = '#17a2b8';

        Object.assign(notification.style, styles);

        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) notification.parentNode.removeChild(notification);
            }, 300);
        }, 5000);
    }

    function showError(msg) { showNotification(msg, "error"); }
    function showSuccess(msg) { showNotification(msg, "success"); }

    // Signup form submit
    signupForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        const enteredOTP = otpInput.value.trim();
        const agree = agreeCheckbox.checked;

        // Validation
        if (!fullName || !email || !password || !confirmPassword || !enteredOTP) {
            showError("Please fill in all fields and enter the OTP");
            return;
        }

        if (!isValidEmail(email)) {
            showError("Please enter a valid email address");
            return;
        }

        if (password.length < 6) {
            showError("Password must be at least 6 characters long");
            return;
        }

        if (password !== confirmPassword) {
            showError("Passwords do not match");
            return;
        }

        if (!agree) {
            showError("Please agree to the Terms and Conditions");
            return;
        }

        // OTP check
        const savedOTP = localStorage.getItem(OTP_STORAGE_KEY);
        if (!savedOTP) {
            showError("Please generate OTP first");
            return;
        }

        let otpData;
        try {
            otpData = JSON.parse(savedOTP);
        } catch {
            showError("Invalid OTP data. Please resend OTP.");
            return;
        }

        if (otpData.email !== email || enteredOTP !== otpData.pin.toString()) {
            showError("Invalid OTP. Please check the code sent to your email.");
            return;
        }

        try {
            // Double-check duplicate email
            const checkResponse = await fetch("https://herbert-schildt-e-commerce-31.onrender.com/get-users");
            const users = await checkResponse.json();
            const emailExists = users.some(u => (u.Email || "").toLowerCase() === email.toLowerCase());

            if (emailExists) {
                showError("This email is already registered. Please use another email.");
                return;
            }

            // Send signup to backend
            // Send signup to backend
            const response = await fetch("http://127.0.0.1:5000/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    email,
                    password,
                    dateJoined: new Date().toISOString() // ✅ send date joined
                })
            });


            const result = await response.json();

            if (!result.success) {
                showError(result.message);
                return;
            }

            // ✅ Clear OTP
            localStorage.removeItem(OTP_STORAGE_KEY);

            showSuccess("Account created successfully! Redirecting to login...");

            signupForm.reset();
            sendBtn.textContent = "Send OTP";
            sendBtn.disabled = false;
            if (timerInterval) clearInterval(timerInterval);

            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);

        } catch (error) {
            console.error("Signup failed:", error);
            showError("Could not create account. Please try again later.");
        }
    });
});
