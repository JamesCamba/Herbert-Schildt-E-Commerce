document.addEventListener('DOMContentLoaded', async function () {
    const otpForm = document.getElementById('otpForm');
    const otpInputs = document.querySelectorAll('.otp-input');
    const nextBtn = document.getElementById('nextBtn');
    const resendBtn = document.getElementById('resendBtn');
    const otpSubtitle = document.getElementById('otpSubtitle');

    // ✅ Load from localStorage
    let userPIN = null;
    try {
        const raw = localStorage.getItem("userPIN");
        userPIN = raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error("Failed to parse userPIN:", e);
    }

    if (!userPIN) {
        console.warn("❌ No userPIN found. Restart reset process.");
        return;
    }

    let user = null;
    try {
        // 🔹 Fetch ALL users
        const res = await fetch("http://127.0.0.1:5000/get-users", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) throw new Error("Failed to fetch users");

        const users = await res.json();

        // 🔹 Find the matching user by email
        user = users.find(u => u.Email === userPIN.email);

        if (!user) {
            console.warn("No user found in DB for:", userPIN.email);
        } else {
            console.log("✅ Found user:", user);
        }
    } catch (err) {
        console.error("Error fetching user from DB:", err);
    }

    // Show masked email
    if (user?.Email) {
        const maskedEmail = user.Email.replace(
            /(.{2})(.*)(@.*)/,
            (m, p1, p2, p3) => p1 + "*".repeat(p2.length) + p3
        );
        otpSubtitle.textContent = `We have sent the code to your email: ${maskedEmail}`;
    }

    // OTP auto-focus
    otpInputs[0].focus();
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', function (e) {
            if (!/^\d$/.test(e.target.value)) {
                e.target.value = '';
                return;
            }
            if (index < otpInputs.length - 1) otpInputs[index + 1].focus();
            checkOTPComplete();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    function checkOTPComplete() {
        const isComplete = Array.from(otpInputs).every(input => input.value);
        nextBtn.disabled = !isComplete;
    }

    // ✅ Verify OTP against userPIN
    otpForm.addEventListener('submit', function (e) {
        e.preventDefault();
        console.log("🚀 OTP form submitted");

        const enteredOTP = Array.from(otpInputs).map(input => input.value).join('');
        console.log("🔑 Entered OTP:", enteredOTP);

        if (!userPIN) {
            console.warn("❌ No userPIN found in localStorage.");
        } else {
            console.log("📦 userPIN object:", userPIN);
            console.log("📨 Expected PIN:", userPIN.pin.toString());
        }

        // ✅ OTP validation
        if (!userPIN || enteredOTP !== userPIN.pin.toString()) {
            console.error("❌ OTP verification failed.");
            showError("Invalid OTP code. Please try again.");
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
            nextBtn.disabled = true;
            return;
        }

        console.log("✅ OTP verified successfully!");

        // ✅ Keep userPIN for new-password.html
        localStorage.setItem("userPIN", JSON.stringify(userPIN));
        console.log("💾 Kept userPIN:", localStorage.getItem("userPIN"));

        console.log("➡️ Redirecting to new-password.html in 1.5s...");
        setTimeout(() => {
            window.location.href = 'new-password.html';
        }, 1500);
    });

    // 🔹 Resend OTP
    resendBtn.addEventListener('click', async function () {
        if (!user) {
            showError("No user found.");
            return;
        }

        const newPin = Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem("userPIN", JSON.stringify({
            email: user.Email,
            pin: newPin
        }));

        console.log("📨 Resent OTP to:", user.Email, "Code:", newPin);

        try {
            await emailjs.send("service_b816d9f", "template_1yu5htt", {
                to_email: user.Email,
                to_name: user.FullName || "User",
                otp_code: newPin
            });
            console.log("✅ Resent OTP!");
            showSuccess("A new OTP has been sent.");
        } catch (error) {
            console.error("❌ Failed to resend OTP", error);
            showError("Failed to resend OTP.");
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
