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
    init() {

        this.READY_PROMISE = new Promise((resolve) => {
            this.READY_RESOLVE = resolve;
        });

        this.handleGoogleRedirectToken(); // ✅ NEW

        Promise.all([
            this.loadCompany(),
            this.loadSettings()
        ]).then(() => {

            this.READY = true;

            if (this.READY_RESOLVE) {
                this.READY_RESOLVE();
            }

            console.log("🟢 Customer App Ready");
        });
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
    async loadCompany() {
        try {

            const data = await this.api("/public/app-info");

            const companyName = data.company?.Name || "E-Shop";
            const logo = data.company?.Logo || "assets/logo.png";

            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.innerText = value;
            };

            const setSrc = (id, value) => {
                const el = document.getElementById(id);
                if (el && value) el.src = value;
            };

            setText("companyName", companyName);
            setSrc("logo", logo);

            const fullTitle = `${companyName} - eCommerce`;
            document.title = fullTitle;

            const pageTitle = document.getElementById("pageTitle");
            if (pageTitle) pageTitle.innerText = fullTitle;

            const favicon = document.getElementById("appFavicon");
            if (favicon && logo) favicon.href = logo;

        } catch (err) {
            console.error(err);
        }
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

    if (!this.isLoggedIn()) {
        window.location.href =
            "/login.html?redirect=checkout.html";
        return;
    }

    window.location.href = "/checkout.html";
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

    container.innerText = message;

    // reset classes properly
    container.className = "";
    container.classList.add(type, "show");

    setTimeout(() => {
        container.classList.remove("show");
    }, 3000);
}
};