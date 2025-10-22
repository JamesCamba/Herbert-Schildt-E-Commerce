document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember');

    // Load saved email if "Remember Me" was checked
    if (localStorage.getItem('rememberEmail')) {
        emailInput.value = localStorage.getItem('rememberEmail');
        rememberCheckbox.checked = true;
    }

    let isSubmitting = false;

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (isSubmitting) return; // block spam
        isSubmitting = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const remember = rememberCheckbox.checked;

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in...";

        // ✅ Basic validation
        if (!email || !password) {
            showError("Please fill in all fields");
            resetSubmitBtn();
            return;
        }
        if (!isValidEmail(email)) {
            showError("Please enter a valid email address");
            resetSubmitBtn();
            return;
        }
        if (password.length < 6) {
            showError("Password must be at least 6 characters long");
            resetSubmitBtn();
            return;
        }

        try {
            const response = await fetch("https://herbert-schildt-e-commerce-15.onrender.com/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            // ✅ If blocked, show modal
            if (result.blocked) {
                document.getElementById("blockedDays").textContent = result.blockedDays;
                document.getElementById("blockModal").classList.remove("hidden");
                resetSubmitBtn();
                return;
            }

            if (!result.success) {
                showError(result.message || "Email or password is wrong");
                resetSubmitBtn();
                return;
            }

            // ✅ Remember email only if checked
            if (remember) {
                localStorage.setItem("rememberEmail", email);
            } else {
                localStorage.removeItem("rememberEmail");
            }

            // ✅ Save user session
            localStorage.setItem("currentUser", JSON.stringify({
                email: result.email,
                fullName: result.fullName,
                userId: result.userId // we'll return this from backend
            }));
            localStorage.setItem("isLoggedIn", "true");

            showSuccess("Login successful! Redirecting...");

            // ✅ Redirect logic
            setTimeout(() => {
                if (result.userId === 14) {
                    window.location.href = "../pages/Admin/admin.html";
                } else {
                    window.location.href = "../../browse-book.html";
                }
            }, 1500);

        } catch (error) {
            showError("Server is offline. Please try again later.");
            console.error(error);
            resetSubmitBtn();
        }

        // function resetSubmitBtn() {
        //     isSubmitting = false;
        //     submitBtn.disabled = false;
        //     submitBtn.textContent = "Login";
        // }

    });


    function resetSubmitBtn() {
    isSubmitting = false;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
}

    // Email validation function
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    function showSuccess(message) {
        showNotification(message, 'success');
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

        if (type === 'error') {
            styles.background = '#dc3545';
        } else if (type === 'success') {
            styles.background = '#28a745';
        } else {
            styles.background = '#17a2b8';
        }

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
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    const forgotLink = document.getElementById("forgotLink");

    forgotLink.addEventListener("click", function (e) {
        const email = emailInput.value.trim();

        if (!email) {
            e.preventDefault(); // stop redirect
            alert("Please enter your email before proceeding to forgot password.");
            return;
        }

        // Save email to localStorage in JSON format
        localStorage.setItem("emailOTP", JSON.stringify({ email }));
    });


    // Input focus effects
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', function () {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });
});

