// ==========================
// CUSTOMER GLOBAL APP MODULE
// ==========================
const CustomerApp = {

    API_BASE: "http://localhost:5000/api",

    READY: false,
    READY_PROMISE: null,
    READY_RESOLVE: null,

    SETTINGS: {},
    CURRENCY_SYMBOL: "$",

    TOKEN: localStorage.getItem("token") || null,
    CUSTOMER: JSON.parse(localStorage.getItem("customer") || "null"),

    // ==========================
    // INIT
    // ==========================
    async init() {

    this.READY_PROMISE = new Promise((resolve) => {
        this.READY_RESOLVE = resolve;
    });

    this.handleGoogleRedirectToken();

    await Promise.all([
        this.loadCompany(),
        this.loadSettings()
    ]);

    this.loadUserUI();

    this.READY = true;

    if (this.READY_RESOLVE) {
        this.READY_RESOLVE();
    }

    console.log("🟢 Customer App Ready");
},

    // ==========================
    // GOOGLE REDIRECT LOGIN HANDLER
    // ==========================
    handleGoogleRedirectToken() {

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");

        if (token) {

            // decode basic payload (optional improvement)
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));

                const customer = {
                    CustomerID: payload.customerId,
                    Email: payload.email,
                    FullName: payload.name
                };

                this.setAuth(token, customer);

                window.history.replaceState({}, document.title, window.location.pathname);

                console.log("🟢 Google login success");
            } catch (e) {
                console.error("Token parse error", e);
            }
        }
    },

    // ==========================
    // AUTH STATE
    // ==========================
    setAuth(token, customer) {
        this.TOKEN = token;
        this.CUSTOMER = customer;

        localStorage.setItem("token", token);
        localStorage.setItem("customer", JSON.stringify(customer));
    },

    logout() {
        this.TOKEN = null;
        this.CUSTOMER = null;

        localStorage.removeItem("token");
        localStorage.removeItem("customer");

        location.href = "/";
    },

    isLoggedIn() {
        return !!this.TOKEN;
    },

    requireLogin(redirect = "/login.html") {
        if (!this.isLoggedIn()) {
            window.location.href = redirect;
        }
    },

    // ==========================
    // API HELPER (WITH AUTH HEADER)
    // ==========================
    async api(url, method = "GET", body = null) {

        const headers = {
            "Content-Type": "application/json"
        };

        // ✅ attach JWT automatically
        if (this.TOKEN) {
            headers["Authorization"] = `Bearer ${this.TOKEN}`;
        }

        const res = await fetch(this.API_BASE + url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        const text = await res.text();

        try {
            return text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Invalid JSON:", text);
            throw new Error("Invalid server response");
        }
    },

    // ==========================
    // COMPANY INFO
    // ==========================
    // ==========================
// COMPANY INFO
// ==========================
async loadCompany() {

    try {

        const data = await this.api("/public/app-info");

        const companyName =
            data.company?.Name ||
            this.SETTINGS?.CompanyName ||
            "E-Shop";

        const logo =
            data.company?.Logo ||
            this.SETTINGS?.Logo ||
            "assets/logo.png";

        // -------------------------
        // HELPERS
        // -------------------------
        const setText = (id, value) => {

            const el = document.getElementById(id);

            if (el) {
                el.innerText = value;
            }
        };

        const setSrc = (id, value) => {

            const el = document.getElementById(id);

            if (!el || !value) return;

            el.onerror = function () {
                this.onerror = null;
                this.src = "assets/logo.png";
            };

            el.src = value;
        };

        // -------------------------
        // HEADER
        // -------------------------
        setText("companyName", companyName);
        setSrc("logo", logo);

        // -------------------------
        // FOOTER
        // -------------------------
        setText("footerName", companyName);
        setText("footerCompany", companyName);

        setSrc("footerLogo", logo);

        // -------------------------
        // PAGE TITLE
        // -------------------------
        const fullTitle = `${companyName} - eCommerce`;

        document.title = fullTitle;

        const pageTitle =
            document.getElementById("pageTitle");

        if (pageTitle) {
            pageTitle.innerText = fullTitle;
        }

        // -------------------------
        // FAVICON
        // -------------------------
        const favicon =
            document.getElementById("appFavicon");

        if (favicon && logo) {
            favicon.href = logo;
        }

        // -------------------------
        // FOOTER YEAR
        // -------------------------
        const yearEl =
            document.getElementById("footerYear");

        if (yearEl) {
            yearEl.innerText = new Date().getFullYear();
        }

        // -------------------------
        // STORE GLOBALLY
        // -------------------------
        this.COMPANY_NAME = companyName;
        this.COMPANY_LOGO = logo;

        console.log("🏢 Company Loaded:", companyName);

    } catch (err) {

        console.error("Company load failed:", err);
    }
},// ==========================
// LOAD CURRENT USER UI
// ==========================
loadUserUI() {

    const customer =
        this.CUSTOMER ||
        JSON.parse(localStorage.getItem("customer") || "null");

    // -------------------------
    // USER NAME
    // -------------------------
    const userName =
        customer?.FullName ||
        customer?.Name ||
        customer?.Email ||
        "Guest";

    const userNameEl =
        document.getElementById("userName");

    if (userNameEl) {
        userNameEl.innerText = userName;
    }

    // -------------------------
    // OPTIONAL USER EMAIL
    // -------------------------
    const emailEl =
        document.getElementById("userEmail");

    if (emailEl && customer?.Email) {
        emailEl.innerText = customer.Email;
    }

    // -------------------------
    // OPTIONAL AVATAR LETTER
    // -------------------------
    const avatarEl =
        document.getElementById("userAvatarText");

    if (avatarEl) {

        const first =
            userName.charAt(0).toUpperCase();

        avatarEl.innerText = first;
    }

    console.log("👤 User UI Loaded:", userName);
},

    // ==========================
    // SETTINGS
    // ==========================
    async loadSettings() {
    try {

        const data = await this.api("/settings");

        this.SETTINGS = {};

        data.forEach(s => {
            this.SETTINGS[s.KeyName] = s.Value;
        });

        // Currency
        const code = (this.SETTINGS.Currency || "USD").toUpperCase();
        await this.loadCurrencySymbol(code);

        // ✅ PAYMENT METHODS (NEW - IMPORTANT)
        this.PAYMENT_METHODS = (this.SETTINGS.AllowedPaymentMethods || "COD")
            .split(",")
            .map(x => x.trim())
            .filter(x => x.length > 0);

        console.log("💳 Allowed Payment Methods:", this.PAYMENT_METHODS);

    } catch (err) {
        console.log("Settings failed", err);
    }
},

    async loadCurrencySymbol(code) {
        try {

            const currencies = await this.api("/settings/currencies");

            const currency = currencies.find(
                c => c.Code?.toUpperCase() === code
            );

            this.CURRENCY_SYMBOL = currency?.Symbol || "$";

        } catch (err) {
            this.CURRENCY_SYMBOL = "$";
        }
    },

    // ==========================
    // CHECKOUT GUARD (IMPORTANT)
    // ==========================
    goToCheckout() {

    const token = localStorage.getItem("token");

if (!token) {

    CustomerApp.toast(
        "Please login to continue checkout",
        "error"
    );

    Auth.open();

    return;
}

window.location.href = "checkout.html";
},

    // ==========================
    // TOAST
    // ==========================
    // toast(message, type = "info") {

    //     let container = document.getElementById("toast");

    //     if (!container) {
    //         container = document.createElement("div");
    //         container.id = "toast";
    //         document.body.appendChild(container);
    //     }

    //     const toast = document.createElement("div");
    //     toast.className = `toast ${type}`;
    //     toast.innerText = message;

    //     container.appendChild(toast);

    //     setTimeout(() => toast.remove(), 3000);
    // }
    toast(message, type = "info") {

    let container = document.getElementById("toast");

    if (!container) {
        container = document.createElement("div");
        container.id = "toast";
        document.body.appendChild(container);
    }

    // create toast card
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icon =
        type === "success" ? "fa-check-circle" :
        type === "error" ? "fa-circle-xmark" :
        type === "warning" ? "fa-triangle-exclamation" :
        "fa-circle-info";

    toast.innerHTML = `
        <i class="fa ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // auto remove with animation
    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
};