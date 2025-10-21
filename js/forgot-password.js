// Forgot Password functionality
document.addEventListener('DOMContentLoaded', function () {
    const emailOption = document.getElementById('emailOption');
    const emailRadio = document.getElementById('emailRadio');
    const continueBtn = document.getElementById('continueBtn');

    // Handle option selection
    emailOption.addEventListener('click', function () {
        selectOption('email');
    });

    // Handle radio button changes
    emailRadio.addEventListener('change', function () {
        if (this.checked) {
            selectOption('email');
        }
    });

    // Function to select an option
    function selectOption(type) {
        // Remove selected class from all options
        emailOption.classList.remove("selected");
        emailRadio.checked = false;

        if (type === "email") {
            emailOption.classList.add("selected");
            emailRadio.checked = true;
            localStorage.setItem("otpType", "email"); // ✅ Save choice
        }

        continueBtn.disabled = false;
    }

    // ✅ Safely read emailOTP and normalize to JSON { email: "..." }
    function getEmailOTPFromStorage() {
        const raw = localStorage.getItem("emailOTP");
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.email) {
                return parsed.email;
            } else {
                // parsed is not object, convert to string
                const email = String(parsed);
                localStorage.setItem("emailOTP", JSON.stringify({ email }));
                return email;
            }
        } catch {
            // raw is plain string
            const email = raw;
            localStorage.setItem("emailOTP", JSON.stringify({ email }));
            return email;
        }
    }

async function displayUserOptions() {
    // get raw string from localStorage
    const raw = localStorage.getItem("emailOTP");
    console.log("📦 Raw emailOTP from localStorage:", raw);

    if (!raw) {
        console.warn("❌ No emailOTP found in localStorage.");
        return;
    }

    // parse JSON object
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        console.error("Invalid emailOTP format in localStorage:", raw);
        return;
    }

    const emailInput = parsed.email; // <-- real email string
    console.log("✉️ Parsed email from emailOTP:", emailInput);

    if (!emailInput) {
        console.warn("❌ emailOTP has no email field.");
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:5000/get-users");
        if (!res.ok) throw new Error("Failed to fetch users");

        const users = await res.json();
        console.log("🗂️ Users fetched from backend:", users);

        const normalizedInput = emailInput.trim().toLowerCase();
        console.log("🔍 Normalized input email:", normalizedInput);

        const user = users.find(u => {
            const dbEmail = (u.Email || "").trim().toLowerCase();
            console.log(`➡️ Comparing DB email: "${dbEmail}" with input: "${normalizedInput}"`);
            return dbEmail === normalizedInput;
        });

        if (!user) {
            console.warn("❌ No user matches the saved emailOTP");
            return;
        }

        // mask email
        const maskedEmail = user.Email.replace(
            /(.{2})(.*)(@.*)/,
            (m, p1, p2, p3) => p1 + "*".repeat(Math.max(0, p2.length)) + p3
        );
        document.getElementById("email").textContent = maskedEmail;

        // save pin
        const pin = Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem("userPIN", JSON.stringify({ email: user.Email, pin }));

        console.log("✅ Generated PIN:", pin);
    } catch (err) {
        console.error("Error fetching users:", err);
    }
}


    // ✅ Restore previous selection OR default to email
    const savedType = localStorage.getItem("otpType");
    if (savedType) {
        selectOption(savedType);
    } else {
        selectOption("email");
    }

    // ✅ Run on load
    displayUserOptions();

    // Debugging logs
    console.log("Raw emailOTP:", localStorage.getItem("emailOTP"));
    console.log("Parsed emailOTP:", getEmailOTPFromStorage());



});
