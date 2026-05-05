const Checkout = {

    cart: [],
    VAT: 0,
    EXTRA: 0,

    subtotal: 0,
    vatAmount: 0,
    extraAmount: 0,
    grandTotal: 0,

    init() {

        CustomerApp.requireLogin();

        this.cart = JSON.parse(localStorage.getItem("cart")) || [];

        if (!this.cart.length) {
            CustomerApp.toast("Cart is empty", "error");
            window.location.href = "index.html";
            return;
        }

        const waitReady = CustomerApp.READY_PROMISE || Promise.resolve();

        waitReady.then(async () => {

            this.loadSettings();
            this.renderUserBox();

            // ✅ IMPORTANT FIX
            await this.loadCustomer();

            this.render();
        });
    },

    /* USER */
    renderUserBox() {

        const box = document.getElementById("userBox");
        const c = CustomerApp.CUSTOMER;

        box.innerHTML = c ? `
            <div class="user-info">
                <i class="fa fa-user-circle"></i>
                <div>
                    <div class="user-name">${c.FullName}</div>
                    <div class="user-email">${c.Email}</div>
                </div>
            </div>
            <button class="logout-btn" onclick="CustomerApp.logout()">Logout</button>
        ` : `<button class="btn-primary">Login</button>`;
    },

    loadSettings() {
        const s = CustomerApp.SETTINGS || {};
        this.VAT = parseFloat(s.VATPercent || 0);
        this.EXTRA = parseFloat(s.AdditionalChargesPercent || 0);
    },

    goHome() {
        window.location.href = "index.html";
    },

    /* ✅ FIXED CUSTOMER LOAD */
    async loadCustomer() {

        try {

            let res = await CustomerApp.api("/customer-auth/me");

            // fallback if API fails
            if (!res || !res.FullName) {
                res = CustomerApp.CUSTOMER;
            }

            if (!res) return;

            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || "";
            };

            set("cName", res.FullName);
            set("cEmail", res.Email);
            set("cPhone", res.Phone);
            set("cAddress1", res.AddressLine1);
            set("cAddress2", res.AddressLine2);
            set("cCity", res.City);
            set("cState", res.State);
            set("cCountry", res.Country);
            set("cPostal", res.PostalCode);

        } catch (e) {
            console.log("Customer load fallback used");
        }
    },

    calculate() {

        this.subtotal = this.cart.reduce((a, i) =>
            a + (parseFloat(i.Total) || 0), 0);

        this.vatAmount = (this.subtotal * this.VAT) / 100;
        this.extraAmount = (this.subtotal * this.EXTRA) / 100;

        this.grandTotal =
            this.subtotal + this.vatAmount + this.extraAmount;
    },

    /* ✅ TABLE DESIGN + UNIT SUPPORT */
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

        this.cart.forEach(i => {

            html += `
                <tr>
                    <td>${i.Name}</td>
                    <td>${i.Qty || "-"}${i.UnitType}</td>
                    <td>${currency} ${(i.Total || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>

            <div class="summary-box">
                <div class="line">
                    <span>Subtotal</span>
                    <b>${currency} ${this.subtotal.toFixed(2)}</b>
                </div>

                <div class="line">
                    <span>VAT (${this.VAT}%)</span>
                    <b>${currency} ${this.vatAmount.toFixed(2)}</b>
                </div>

                <div class="line">
                    <span>Extra (${this.EXTRA}%)</span>
                    <b>${currency} ${this.extraAmount.toFixed(2)}</b>
                </div>

                <div class="line total">
                    <span>Total</span>
                    <b>${currency} ${this.grandTotal.toFixed(2)}</b>
                </div>
            </div>
        `;

        document.getElementById("orderSummary").innerHTML = html;
    },

    getFormData() {

        const g = id => document.getElementById(id).value;

        return {
            FullName: g("cName"),
            Email: g("cEmail"),
            Phone: g("cPhone"),
            AddressLine1: g("cAddress1"),
            AddressLine2: g("cAddress2"),
            City: g("cCity"),
            State: g("cState"),
            Country: g("cCountry"),
            PostalCode: g("cPostal")
        };
    },

    validate() {

        const f = this.getFormData();

        if (!f.FullName || !f.Email || !f.Phone) {
            CustomerApp.toast("Name, Email, Phone required", "error");
            return false;
        }

        return true;
    },

    async placeOrder() {

        if (!this.validate()) return;

        const order = {
            Customer: this.getFormData(),
            Items: this.cart,
            SubTotal: this.subtotal,
            VAT: this.vatAmount,
            AdditionalCharges: this.extraAmount,
            GrandTotal: this.grandTotal
        };

        try {

            const res = await CustomerApp.api("/orders/create", "POST", order);

            if (res.success) {
                CustomerApp.toast("Order placed", "success");
                localStorage.removeItem("cart");

                setTimeout(() => location.href = "index.html", 1000);
            }

        } catch {
            CustomerApp.toast("Order failed", "error");
        }
    }
};

function goHome() {
    window.location.href = "index.html";
}

window.onload = () => Checkout.init();