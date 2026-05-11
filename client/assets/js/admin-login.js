async function loadAppInfo() {
    try {
        console.log("Loading app info...");

        const res = await fetch(`${CONFIG.API_BASE}/public/app-info`);

        if (!res.ok) throw new Error("API not reachable");

        const data = await res.json();

        console.log("DATA:", data);

        const companyName = data.company?.Name || "My Company";
        const logo = data.company?.Logo;

        /* =========================
           SAFE DOM HELPERS
        ========================= */
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };

        const setAttr = (id, attr, value) => {
            const el = document.getElementById(id);
            if (el && value) el[attr] = value;
        };

        /* =========================
           BRAND UI
        ========================= */
        setText("brandName", companyName);
        setText("appTitle", `${companyName} - eCommerce`);
        document.getElementById("browserTitle").innerText =
    `${companyName} - eCommerce`;

        if (logo) {
            setAttr("brandLogo", "src", logo);

            const favicon = document.getElementById("appFavicon");
            if (favicon) {
                favicon.href = logo;
            }
        }

        /* =========================
           TITLE
        ========================= */
        document.title = `${companyName} - eCommerce`;

        /* =========================
           FOOTER
        ========================= */
        const footer = document.getElementById("appFooter");
        if (footer) {
            footer.innerHTML =
                `© ${new Date().getFullYear()} ${data.copyrightCompany || companyName}
                 • Developed by <strong>${data.developedBy || "Team"}</strong>`;
        }

    } catch (err) {
        console.error("❌ ERROR:", err);

        document.title = "App - eCommerce";

        const brand = document.getElementById("brandName");
        if (brand) brand.innerText = "App Name";

        const footer = document.getElementById("appFooter");
        if (footer) footer.innerText = "⚠ Unable to load system info";
    }
}

/* =========================
   LOGIN
========================= */
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("🚀 Login started");

    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    try {
        const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        console.log("STATUS:", res.status);

        const text = await res.text();
        console.log("RAW:", text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error("Invalid JSON:", text);
            showMessage("Server response error", "error");
            return;
        }

        if (!res.ok) {
            showMessage(data.message || "Login failed", "error");
            return;
        }

        showMessage("Login successful! Redirecting...", "success");

        /* =========================
           ✅ STORE USER SESSION (UNCHANGED - DO NOT REMOVE)
        ========================= */
        localStorage.setItem("token", data.token || "");
        localStorage.setItem("role", data.role || "User");

        // name support (backend flexible)
        localStorage.setItem(
            "name",
            data.user?.name || data.user?.Name || "Admin"
        );

        localStorage.setItem("email", data.user?.email || "");
        localStorage.setItem("userId", data.user?.id || "");

        // optional photo
        localStorage.setItem("photo", data.user?.photo || "");

        setTimeout(() => {
            window.location.href = "admin/dashboard.html";
        }, 1200);

    } catch (err) {
        console.error("ERROR:", err);
        showMessage("Server not reachable", "error");
    }
});

/* =========================
   MESSAGE UI (IMPROVED SAFETY)
========================= */
function showMessage(message, type = "info") {
    const container = document.getElementById("toastContainer");

    if (!container) return;

    const icons = {
        success: "fa-check-circle",
        error: "fa-times-circle",
        info: "fa-info-circle",
        warning: "fa-exclamation-circle"
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <i class="fa ${icons[type] || icons.info}"></i>
        <div class="msg-text">${message}</div>
        <div class="close"><i class="fa fa-xmark"></i></div>
    `;

    container.appendChild(toast);

    // close manually
    toast.querySelector(".close").onclick = () => removeToast(toast);

    // auto remove
    setTimeout(() => removeToast(toast), 3000);
}

function removeToast(toast){
    toast.style.animation = "fadeOut 0.4s ease forwards";
    setTimeout(() => toast.remove(), 400);
}

/* =========================
   FORGOT PASSWORD MODAL
========================= */
document.getElementById("forgotLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    const modal = document.getElementById("forgotModal");
    if (modal) modal.style.display = "flex";
});

function closeModal() {
    const modal = document.getElementById("forgotModal");
    if (modal) modal.style.display = "none";
}

async function sendReset() {
    const email = document.getElementById("forgotEmail")?.value;

    if (!email) {
        alert("Please enter email");
        return;
    }

    try {
        const res = await fetch(`${CONFIG.API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
});

        const data = await res.json();

        alert(data.message || "Request sent");
        closeModal();

    } catch (err) {
        console.error(err);
        alert("Server error");
    }
}