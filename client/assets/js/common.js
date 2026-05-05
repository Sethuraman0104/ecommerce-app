// ==========================
// GLOBAL COMMON APP MODULE
// ==========================
const App = {

    API_BASE: "http://localhost:5000/api",

    READY: false,
READY_PROMISE: null,
READY_RESOLVE: null,

    // ==========================
    // INIT
    // ==========================
    init() {
    this.READY_PROMISE = new Promise((resolve) => {
        this.READY_RESOLVE = resolve;
    });

    this.checkAuth();
    this.startSessionMonitor();

    Promise.all([
        this.loadUser(),
        this.loadCompany(),
        this.loadSettings()
    ]).then(() => {
        this.READY = true;

        if (this.READY_RESOLVE) {
            this.READY_RESOLVE(); // 🔥 unlock app
        }

        console.log("✅ App Ready");
    });
},

    // ==========================
    // AUTH
    // ==========================
    checkAuth() {
        const token = localStorage.getItem("token");

        if (!token) {
            window.location.href = "/admin-login.html";
        }
    },

    startSessionMonitor() {
        this.resetSessionTimer();

        const events = ["click", "mousemove", "keydown", "scroll", "touchstart"];

        events.forEach(evt => {
            window.addEventListener(evt, () => this.resetSessionTimer());
        });
    },

    resetSessionTimer() {

        clearTimeout(this.SESSION_TIMER);

        this.SESSION_TIMER = setTimeout(() => {
            this.sessionExpired();
        }, this.SESSION_TIMEOUT);
    },

    getToken() {
        return localStorage.getItem("token");
    },

    logout() {
        localStorage.clear();
        window.location.href = "/admin-login.html";
    },
    goToProfile() {
    window.location.href = "profile.html";
    },
    sessionExpired() {

        this.logout(); // clear storage immediately

        let modal = document.getElementById("sessionModal");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "sessionModal";
            modal.innerHTML = `
            <div class="session-box">
                <h2>Session Expired</h2>
                <p>Your session has expired due to inactivity.</p>
                <button onclick="App.goLogin()">Login Again</button>
            </div>
        `;
            document.body.appendChild(modal);
        }

        modal.style.display = "flex";
    }, goLogin() {
        window.location.href = "/admin-login.html";
    },

    // ==========================
    // API HELPER (FIXED SAFE JSON HANDLING)
    // ==========================
    async api(url, method = "GET", body = null) {
        console.log("TOKEN:", this.getToken());
        const res = await fetch(this.API_BASE + url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": this.getToken() ? `Bearer ${this.getToken()}` : undefined
            },
            body: body ? JSON.stringify(body) : null
        });

        // 🔥 FIX: prevent JSON.parse crash when backend returns HTML/empty/error page
        const text = await res.text();

        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Invalid JSON response from:", url);
            console.error("Raw response:", text);
            throw new Error("Server returned invalid response (not JSON)");
        }

        if (!res.ok) {

            if (res.status === 401) {
                this.sessionExpired();
                throw new Error("Session expired");
            }

            throw new Error(data.message || "API Error");
        }

        return data;
    },

    // ==========================
    // USER DATA
    // ==========================
    async loadUser() {
        try {
            const data = await this.api("/profile");

            this.setText("userName", data.Name || "Admin");
            this.setText("userRole", localStorage.getItem("role") || "User");

            const photo = document.getElementById("userPhoto");
            if (photo && data.Photo) photo.src = data.Photo;

            if (data.LastLogin) {
                this.setText(
                    "lastLogin",
                    "Last login: " + this.formatDate(data.LastLogin)
                );
            } else {
                this.setText("lastLogin", "Last login: First login");
            }

        } catch (err) {
            console.error("User load failed:", err);
        }
    },

    // ==========================
    // COMPANY / BRANDING
    // ==========================
    async loadCompany() {
        try {
            const res = await fetch(this.API_BASE + "/public/app-info");
            const data = await res.json();

            const companyName =
                data.Name || data.company?.Name || "E-Shop";

            const logo =
                data.Logo || data.company?.Logo || "/assets/logo.png";

            const copyright =
                data.Copyright ||
                data.copyrightCompany ||
                companyName;

            const developedBy =
                data.DevelopedBy ||
                data.developedBy ||
                "HR Info";

            this.setText("companyName", companyName);

            const logoEl = document.getElementById("companyLogo");
            if (logoEl) logoEl.src = logo;

            document.title = `${companyName} - Admin Panel`;

            this.setFavicon(logo);

            this.renderFooter(companyName, logo, copyright, developedBy);

        } catch (err) {
            console.error("Company load failed:", err);
        }
    },

    // ==========================
    // FOOTER
    // ==========================
    renderFooter(companyName, logo, copyright, developedBy) {

        const footer = document.getElementById("appFooter");
        if (!footer) return;

        footer.innerHTML = `
            <div class="footer-container">

                <div class="footer-left">
                    <div class="footer-logo">
                        <img src="${logo}">
                    </div>
                    <div>
                        <div class="footer-company">${companyName}</div>
                        <div class="footer-tagline">
                            Smart eCommerce Management System
                        </div>
                    </div>
                </div>

                <div class="footer-center">
                    <a href="/admin/dashboard.html">Dashboard</a>
                    <a href="/admin/products.html">Products</a>
                    <a href="#">Orders</a>
                    <a href="#">Reports</a>
                </div>

                <div class="footer-right">
                    <div>© ${new Date().getFullYear()} ${copyright}</div>
                    <div>Developed by <strong>${developedBy}</strong></div>
                </div>

            </div>
        `;
    },

    // ==========================
    // HELPERS
    // ==========================
    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    },

    setFavicon(logo) {
        let favicon = document.getElementById("appFavicon");

        if (!favicon) {
            favicon = document.createElement("link");
            favicon.id = "appFavicon";
            favicon.rel = "icon";
            document.head.appendChild(favicon);
        }

        favicon.href = logo;
    },

    formatDate(dateString) {
        // prevent timezone shift by forcing raw parsing
    const parts = dateString.split(/[- : T .]/);

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const hour = parseInt(parts[3]);
    const minute = parseInt(parts[4]);

    const date = new Date(year, month, day, hour, minute);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");

    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;

    return (
        String(date.getDate()).padStart(2, "0") + "/" +
        months[date.getMonth()] + "/" +
        date.getFullYear() + " " +
        h + ":" + m + " " + ampm
    );
    },

    // ==========================
    // 🔥 MODERN TOAST (NEW UI)
    // ==========================
    toast(message, type = "info") {

        const containerId = "toast";
        let container = document.getElementById(containerId);

        if (!container) {
            container = document.createElement("div");
            container.id = containerId;
            document.body.appendChild(container);
        }

        const icons = {
            success: "fa-check-circle",
            error: "fa-circle-xmark",
            warning: "fa-triangle-exclamation",
            info: "fa-circle-info"
        };

        const colors = {
            success: "#22c55e",
            error: "#ef4444",
            warning: "#f59e0b",
            info: "#3b82f6"
        };

        const toast = document.createElement("div");
        toast.className = `app-toast ${type}`;

        toast.innerHTML = `
            <div class="toast-icon" style="color:${colors[type] || colors.info}">
                <i class="fa ${icons[type] || icons.info}"></i>
            </div>

            <div class="toast-message">
                ${message}
            </div>

            <div class="toast-close" onclick="this.parentElement.remove()">
                <i class="fa fa-xmark"></i>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("hide");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    async loadSettings() {
    try {
        const data = await this.api("/settings");

        this.SETTINGS = {};
        data.forEach(s => {
            this.SETTINGS[s.KeyName] = s.Value;
        });

        const code = (this.SETTINGS.Currency || "USD").trim().toUpperCase();

        await this.loadCurrencySymbol(code);

        this.CURRENCY_CODE = code;
        this.CURRENCY_SYMBOL = this.CURRENCY_SYMBOL || "$";

        window.CURRENCY_SYMBOL = this.CURRENCY_SYMBOL;

        this.isReady = true;

    } catch (err) {

        console.error("Settings load failed:", err);

        this.CURRENCY_CODE = "USD";
        this.CURRENCY_SYMBOL = "$";
        window.CURRENCY_SYMBOL = "$";

        this.isReady = true;
    }
},async loadCurrencySymbol(code) {

    try {
        const currencies = await this.api("/settings/currencies");

        const currency = currencies.find(
    c => c.Code?.trim().toUpperCase() === code
);
console.log("Sethu" + currency?.Symbol);
        this.CURRENCY_SYMBOL = currency?.Symbol || code;
        this.CURRENCY_NAME = currency?.Name || code;

    } catch (err) {
        console.error("Currency load failed:", err);

        this.CURRENCY_SYMBOL = "$";
        this.CURRENCY_NAME = "USD";
    }
},
    // ==========================
    // SESSION MANAGEMENT
    // ==========================
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    SESSION_TIMER: null,
    SETTINGS: {},
    CURRENCY: "$",
    CURRENCY_SYMBOL: "$",
    CURRENCY_NAME: "USD",
};