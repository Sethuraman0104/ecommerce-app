const Checkout = {

    cart: [],
    VAT: 0,
    EXTRA: 0,
    paymentMethods: [],

    subtotal: 0,
    vatAmount: 0,
    extraAmount: 0,
    grandTotal: 0,
    coupon: null,
    discountAmount: 0,
    discountPercent: 0,

    /* ================= INIT ================= */
    /* ================= INIT ================= */
async init() {

    try {

        // =========================
        // CHECK LOGIN TOKEN
        // =========================

        const token = localStorage.getItem("token");

        // no token
        if (!token) {

            CustomerApp.toast(
                "Please login to continue",
                "error"
            );

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1200);

            return;
        }

        // validate token from server
        try {

            const res = await fetch(
                `${CustomerApp.API_BASE}/customer-auth/me`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            // invalid token
            if (!res.ok) {

                localStorage.removeItem("token");
                localStorage.removeItem("customer");

                CustomerApp.toast(
                    "Session expired. Please login again",
                    "error"
                );

                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1200);

                return;
            }

            // valid customer
            const customer = await res.json();

            // save fresh customer
            localStorage.setItem(
                "customer",
                JSON.stringify(customer)
            );

            CustomerApp.CUSTOMER = customer;

        } catch (err) {

            console.error("Token validation error:", err);

            localStorage.removeItem("token");
            localStorage.removeItem("customer");

            CustomerApp.toast(
                "Authentication failed",
                "error"
            );

            setTimeout(() => {
                window.location.href = "index.html";
            }, 1200);

            return;
        }

        // =========================
        // 🔥 HANDLE PAYMENT RETURN
        // =========================

        const urlParams =
            new URLSearchParams(window.location.search);

        const paymentStatus =
            urlParams.get("payment");

        if (paymentStatus === "success") {

            const result = JSON.parse(
                localStorage.getItem("paymentResult") || "null"
            );

            if (result) {

                console.log("💳 Payment Success:", result);

                // prevent duplicate orders
                if (!localStorage.getItem("orderPlaced")) {

                    await this.finalizeOrder("Online");

                    localStorage.setItem(
                        "orderPlaced",
                        "true"
                    );
                }

                localStorage.removeItem("paymentResult");

                CustomerApp.toast(
                    "Payment successful",
                    "success"
                );
            }

        } else if (paymentStatus === "cancel") {

            CustomerApp.toast(
                "Payment cancelled",
                "error"
            );
        }

        // cleanup URL
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        // =========================
        // CART LOAD
        // =========================

        this.cart =
            JSON.parse(localStorage.getItem("cart")) || [];

        if (!this.cart.length) {

            CustomerApp.toast(
                "Cart is empty",
                "error"
            );

            window.location.href = "index.html";

            return;
        }

        // =========================
        // WAIT APP READY
        // =========================

        if (CustomerApp.READY_PROMISE) {

            await CustomerApp.READY_PROMISE;
        }

        await this.loadSettings();
        await this.loadCustomer();

        this.renderUserBox();
        this.render();

        console.log("✅ Checkout initialized");

    } catch (err) {

        console.error("❌ INIT ERROR:", err);

        CustomerApp.toast(
            "Checkout init failed",
            "error"
        );
    }
},
    async applyCoupon(code) {

        try {

            if (!code) {
                CustomerApp.toast("Enter coupon code", "error");
                return;
            }

            const res = await CustomerApp.api(
                `/customer-auth/coupons/validate?code=${code}`
            );

            if (!res || !res.valid) {
                CustomerApp.toast("Invalid coupon", "error");
                return;
            }

            this.coupon = res.coupon;

            this.discountAmount =
                (this.subtotal * this.coupon.DiscountPercent) / 100;
            this.discountPercent = this.coupon.DiscountPercent;

            this.calculate();

            this.render();

            CustomerApp.toast("Coupon applied", "success");

            this.syncAllSummaries();

        } catch (err) {
            console.error(err);
            CustomerApp.toast("Coupon error", "error");
        }
    },

    syncAllSummaries() {

        // always recalculate first
        this.calculate();

        const c = CustomerApp.CURRENCY_SYMBOL;

        // ===== update main page =====
        const main = document.querySelector(".order-summary-box");
        if (main) {
            main.innerHTML = `
            <div class="summary-line"><span>Subtotal</span><span>${c} ${this.subtotal.toFixed(2)}</span></div>
            <div class="summary-line"><span>VAT (${this.VAT}%)</span><span>${c} ${this.vatAmount.toFixed(2)}</span></div>
            <div class="summary-line"><span>Additional Charges (${this.EXTRA}%)</span><span>${c} ${this.extraAmount.toFixed(2)}</span></div>
            ${this.discountAmount > 0 ? `
            <div class="summary-line discount"><span>Discount (${this.discountPercent}%)</span><span>- ${c} ${this.discountAmount.toFixed(2)}</span></div>
            ` : ""}
            <div class="summary-total"><span>Grand Total</span><span>${c} ${this.grandTotal.toFixed(2)}</span></div>
        `;
        }

        // ===== update modal =====
        const modal = document.querySelector(".pay-summary");
        if (modal) {
            modal.innerHTML = `
            <div class="line"><span>Subtotal</span><span>${c} ${this.subtotal.toFixed(2)}</span></div>
            <div class="line"><span>VAT (${this.VAT}%)</span><span>${c} ${this.vatAmount.toFixed(2)}</span></div>
            <div class="line"><span>Additional</span><span>${c} ${this.extraAmount.toFixed(2)}</span></div>
            <div class="line discount"><span>Discount (${this.discountPercent}%)</span><span>- ${c} ${(this.discountAmount || 0).toFixed(2)}</span></div>
            <hr>
            <div class="total"><span>Total</span><span>${c} ${this.grandTotal.toFixed(2)}</span></div>
        `;
        }
    },

    /* ================= USER RENDER ================= */
renderUserBox() {

    const box = document.getElementById("userBox");
    const c = CustomerApp.CUSTOMER;

    if (!c) {
        box.innerHTML = `
            <button class="checkout-login-btn" onclick="location.href='login.html'">
                <i class="fa fa-sign-in-alt"></i>
            </button>
        `;
        return;
    }

    box.innerHTML = `
        <i class="fa fa-user-circle checkout-user-icon"></i>
        <div class="checkout-user-name">${c.FullName}</div>
    `;
},

    /* ================= SETTINGS ================= */
    async loadSettings() {

        const s = CustomerApp.SETTINGS || {};

        this.VAT = parseFloat(s.VATPercent || 0);
        this.EXTRA = parseFloat(s.AdditionalChargesPercent || 0);

        // ✅ USE GLOBAL SETTINGS (NOT LOCAL SPLIT ANYMORE)
        this.paymentMethods = (CustomerApp.PAYMENT_METHODS && CustomerApp.PAYMENT_METHODS.length)
            ? CustomerApp.PAYMENT_METHODS
            : ["COD"];

        console.log("💳 Payment Methods:", this.paymentMethods);
    },

    /* ================= CUSTOMER ================= */
    async loadCustomer() {

        try {

            let res = await CustomerApp.api("/customer-auth/me");

            if (!res) {
                res = CustomerApp.CUSTOMER;
            }

            console.log("👤 Loaded customer:", res);

            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val ?? "";
            };

            set("cName", res.FullName);
            set("cEmail", res.Email);
            set("cPhone", res.Phone ?? "");

            set("cAddress1", res.AddressLine1 ?? "");
            set("cAddress2", res.AddressLine2 ?? "");

            set("cCity", res.City ?? "");
            set("cState", res.State ?? "");
            set("cCountry", res.Country ?? "");
            set("cPostal", res.PostalCode ?? "");

        } catch (err) {
            console.error("Customer load error:", err);
        }
    },

    /* ================= CALCULATE ================= */
    calculate() {

        this.subtotal = this.cart.reduce((a, i) =>
            a + (parseFloat(i.Total) || 0), 0);

        this.vatAmount = (this.subtotal * this.VAT) / 100;
        this.extraAmount = (this.subtotal * this.EXTRA) / 100;

        this.grandTotal =
            this.subtotal +
            this.vatAmount +
            this.extraAmount -
            (this.discountAmount || 0);
    },

    /* ================= RENDER ================= */
    render() {

        this.calculate();

        const currency = CustomerApp.CURRENCY_SYMBOL;

        let html = `
        <table class="order-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Qty - Unit</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;

        // ================= ITEMS =================
        this.cart.forEach(i => {
            html += `
            <tr>
                <td>
                    <div class="product-cell">
                        <div class="p-name">${i.Name}</div>
                    </div>
                </td>
                <td>${i.Qty} ${i.UnitType || "pcs"}</td>
                <td>${currency} ${(i.Total || 0).toFixed(2)}</td>
            </tr>
        `;
        });

        html += `
            </tbody>
        </table>

        <!-- ================= SUMMARY ================= -->
        <div class="order-summary-box">

            <div class="summary-line">
                <span>Subtotal</span>
                <span>${currency} ${this.subtotal.toFixed(2)}</span>
            </div>

            <div class="summary-line">
                <span>VAT (${this.VAT}%)</span>
                <span>${currency} ${this.vatAmount.toFixed(2)}</span>
            </div>

            <div class="summary-line">
                <span>Additional Charges (${this.EXTRA}%)</span>
                <span>${currency} ${this.extraAmount.toFixed(2)}</span>
            </div>

            ${this.discountAmount > 0
                ? `
                <div class="summary-line discount">
                    <span>Discount (${this.discountPercent})%</span>
                    <span>- ${currency} ${this.discountAmount.toFixed(2)}</span>
                </div>
                `
                : ""
            }

            <div class="summary-total">
                <span>Grand Total</span>
                <span>${currency} ${this.grandTotal.toFixed(2)}</span>
            </div>

        </div>
    `;

        document.getElementById("orderSummary").innerHTML = html;
    },

    /* ================= FORM ================= */
    getFormData() {

        const get = (id) => {
            const el = document.getElementById(id);
            if (!el) return "";
            return (el.value || "").trim();
        };

        return {
            FullName: get("cName"),
            Email: get("cEmail"),
            Phone: get("cPhone"),
            AddressLine1: get("cAddress1"),
            AddressLine2: get("cAddress2"),
            City: get("cCity"),
            State: get("cState"),
            Country: get("cCountry"),
            PostalCode: get("cPostal")
        };
    },

    /* ================= VALIDATION ================= */
    validate() {

        const f = this.getFormData();

        const missing = [];

        for (const key in f) {
            if (!f[key] || f[key].trim() === "") {
                missing.push(key);
            }
        }

        if (missing.length > 0) {

            CustomerApp.toast(
                "Please fill: " + missing.join(", "),
                "error"
            );

            console.warn("❌ Missing fields:", missing);
            return false;
        }

        return true;
    },

    /* ================= UPDATE CUSTOMER ================= */
    async updateCustomer() {

        try {

            const res = await CustomerApp.api(
                "/customer-auth/update",
                "PUT",
                this.getFormData()
            );

            console.log("Customer update response:", res);

            if (res?.success) return true;

            CustomerApp.toast(res?.message || "Update failed", "error");

            return false;

        } catch (err) {
            console.error("Update error:", err);
            return false;
        }
    },

    /* ================= PLACE ORDER ================= */
    async placeOrder() {

        console.log("🚀 Place Order Clicked");
        console.log("📦 INPUT VALUES:");
        console.table(this.getFormData());

        try {

            if (!this.validate()) {
                console.log("❌ Validation failed");
                return;
            }

            console.log("✅ Validation passed");

            const updated = await this.updateCustomer();

            if (!updated) {
                CustomerApp.toast("Customer update failed", "error");
                return;
            }

            this.showPaymentSection();

        } catch (err) {
            console.error("❌ placeOrder error:", err);
            CustomerApp.toast("Unexpected error", "error");
        }
    },

    /* ================= PAYMENT UI ================= */
    showPaymentSection() {

        let modal = document.getElementById("paymentModal");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "paymentModal";
            document.body.appendChild(modal);
        }

        const c = CustomerApp.CURRENCY_SYMBOL;

        modal.innerHTML = `
    <div class="pay-overlay" onclick="Checkout.closePaymentModal()"></div>

    <div class="pay-modal">

        <!-- HEADER -->
        <div class="pay-header">
            <h3>💳 Payment & Summary</h3>
            <button class="pay-close" onclick="Checkout.closePaymentModal()">✕</button>
        </div>

        <!-- BODY -->
        <div class="pay-body">

            <!-- LEFT -->
            <div class="pay-left">

                <!-- COUPON -->
                <div class="pay-section">
                    <label>Coupon Code</label>
                    <div class="pay-coupon">
                        <input id="couponCode" placeholder="Enter coupon">
                        <button onclick="Checkout.applyCoupon(document.getElementById('couponCode').value)">
                            <i class="fa fa-tag"></i> Apply
                        </button>
                    </div>
                </div>

                <!-- PAYMENT OPTIONS -->
                <div class="pay-section">
                    <label>Select Payment Method</label>
                    <div id="paymentOptions" class="pay-options"></div>
                </div>

                <!-- CARD -->
                <div id="cardForm" class="pay-card" style="display:none;">
                    <input id="cardNumber" placeholder="Card Number">
                    <input id="cardName" placeholder="Card Holder Name">

                    <div class="pay-row">
                        <input id="cardExpiry" placeholder="MM/YY">
                        <input id="cardCVV" placeholder="CVV">
                    </div>

                    <button class="btn-primary" onclick="Checkout.payCard()">
                        <i class="fa fa-credit-card"></i> Pay with Card
                    </button>
                </div>

            </div>

            <!-- RIGHT -->
            <div class="pay-right">

                <h4>Order Summary</h4>

                <div class="pay-summary">

                    <div class="line">
                        <span>Subtotal</span>
                        <span>${c} ${this.subtotal.toFixed(2)}</span>
                    </div>

                    <div class="line">
                        <span>VAT (${this.VAT}%)</span>
                        <span>${c} ${this.vatAmount.toFixed(2)}</span>
                    </div>

                    <div class="line">
                        <span>Additional</span>
                        <span>${c} ${this.extraAmount.toFixed(2)}</span>
                    </div>

                    <div class="line discount">
                        <span>Discount (${this.discountPercent}%)</span>
                        <span>- ${c} ${(this.discountAmount || 0).toFixed(2)}</span>
                    </div>

                    <hr>

                    <div class="total">
                        <span>Total</span>
                        <span>${c} ${this.grandTotal.toFixed(2)}</span>
                    </div>

                </div>

            </div>

        </div>

        <!-- FOOTER -->
        <div class="pay-footer">
            <button class="btn-secondary" onclick="Checkout.closePaymentModal()"><i class="fa fa-times-circle"></i> Cancel</button>
            <button class="btn-primary" onclick="Checkout.processPayment()"><i class="fa fa-money-bill-wave"></i> Pay Now</button>
        </div>

    </div>
    `;

        const container = modal.querySelector("#paymentOptions");

        container.innerHTML = this.paymentMethods.map(m => `
        <label class="pay-option">
            <input type="radio" name="paymentMethod" value="${m}">
            <span>${this.getPaymentLabel(m)}</span>
        </label>
    `).join("");

        modal.style.display = "flex";
    },
    getPaymentLabel(method) {

        const map = {
            Cash: "💵 Cash on Delivery",
            Card: "💳 Card Payment",
            Online: "🌐 Online Payment",
            COD: "🚚 Cash on Delivery"
        };

        return map[method] || method;
    },
    async payCard() {

        const card = {
            number: document.getElementById("cardNumber").value,
            name: document.getElementById("cardName").value,
            expiry: document.getElementById("cardExpiry").value,
            cvv: document.getElementById("cardCVV").value
        };

        if (!card.number || !card.name || !card.expiry || !card.cvv) {
            CustomerApp.toast("Fill card details", "error");
            return;
        }

        console.log("💳 Processing card payment...");

        // simulate success OR call payment API
        await this.finalizeOrder("Card");
    },
    redirectToGateway() {

        const amount = this.grandTotal;

        const url =
            `/payment-gateway.html?amount=${amount}&order=TEMP`;

        window.location.href = url;
    },
    closePaymentModal() {
        const modal = document.getElementById("paymentModal");
        if (modal) modal.style.display = "none";
    },

    /* ================= PAYMENT ================= */
    async processPayment() {

        const selected = document.querySelector("input[name='paymentMethod']:checked");

        if (!selected) {
            CustomerApp.toast("Select payment method", "error");
            return;
        }

        const method = selected.value;

        if (method === "Cash" || method === "COD") {
            await this.finalizeOrder(method, "Pending");
            return;
        }

        if (method === "Card") {
            document.getElementById("cardForm").style.display = "block";
            return;
        }

        if (method === "Online") {
            this.redirectToGateway();
            return;
        }
    },

    /* ================= FINAL ORDER ================= */
    async finalizeOrder(method, paymentStatus = "Success") {
        console.log(method + 'Sethu Method');
        console.log(paymentStatus + 'Sethu Method');
        const payload = {
    Customer: this.getFormData(),
    Items: this.cart,

    SubTotal: this.subtotal,

    VAT: {
        percent: this.VAT,
        amount: this.vatAmount
    },

    AdditionalCharges: {
        percent: this.EXTRA,
        amount: this.extraAmount
    },

    DiscountAmount: this.discountAmount,
    DiscountPercent: this.discountPercent,

    CouponID: this.coupon?.CouponID || null,
    GrandTotal: this.grandTotal,

    PaymentMethod: method,
    PaymentStatus: paymentStatus
};
        try {

            const res = await CustomerApp.api("/orders/full-create", "POST", payload);

            if (res?.success) {

                CustomerApp.toast("Order placed successfully", "success");

                localStorage.removeItem("cart");

                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1200);
            }

        } catch (err) {
            console.error(err);
            CustomerApp.toast("Order failed", "error");
        }
    }
};

/* ================= INIT ================= */
window.onload = () => Checkout.init();

function goHome() {
    window.location.href = "index.html";
}