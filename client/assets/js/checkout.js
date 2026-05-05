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

    waitReady.then(() => {

        this.loadSettings();
        this.renderHeader();
        this.loadCustomer();
        this.render();
    });
},

    /* ================= SETTINGS ================= */
    loadSettings() {

        // SAFE READ (IMPORTANT FIX)
        const settings = CustomerApp.SETTINGS || {};

        this.VAT = parseFloat(settings.VATPercent ?? 0) || 0;
        this.EXTRA = parseFloat(settings.AdditionalChargesPercent ?? 0) || 0;
    },

    /* ================= HEADER ================= */
    renderHeader() {

        const customer = CustomerApp.CUSTOMER;
        if (!customer) return;

        const header = document.createElement("div");
        header.className = "checkout-user-header";

        header.innerHTML = `
            <div class="user-box">
                <i class="fa fa-user-circle"></i>
                <div>
                    <b>${customer.FullName || ""}</b><br>
                    <small>${customer.Email || ""}</small>
                </div>
            </div>
        `;

        document.querySelector(".checkout-container")?.prepend(header);
    },

    /* ================= CUSTOMER ================= */
    async loadCustomer() {

        try {
            const res = await CustomerApp.api("/customer-auth/me");

            if (!res) return;

            document.getElementById("cName").value = res.FullName || "";
            document.getElementById("cEmail").value = res.Email || "";
            document.getElementById("cPhone").value = res.Phone || "";
            document.getElementById("cAddress1").value = res.AddressLine1 || "";
            document.getElementById("cAddress2").value = res.AddressLine2 || "";
            document.getElementById("cCity").value = res.City || "";
            document.getElementById("cState").value = res.State || "";
            document.getElementById("cCountry").value = res.Country || "";
            document.getElementById("cPostal").value = res.PostalCode || "";

        } catch (err) {
            console.log("Customer load failed", err);
        }
    },

    /* ================= CALCULATE ================= */
    calculate() {

        this.subtotal = this.cart.reduce((a, i) => {
            return a + (parseFloat(i.Total) || 0);
        }, 0);

        this.vatAmount = (this.subtotal * this.VAT) / 100;
        this.extraAmount = (this.subtotal * this.EXTRA) / 100;

        this.grandTotal =
            this.subtotal + this.vatAmount + this.extraAmount;
    },

    /* ================= RENDER ================= */
    render() {

        this.calculate();

        const currency = CustomerApp.CURRENCY_SYMBOL;

        let html = "";

        // ITEMS
        this.cart.forEach(i => {
            html += `
                <div class="order-item">
                    <span>${i.Name} × ${i.Qty}</span>
                    <b>${currency} ${(i.Total || 0).toFixed(2)}</b>
                </div>
            `;
        });

        // SUMMARY
        html += `
            <hr>

            <div class="summary-line">
                <span>Subtotal</span>
                <b>${currency} ${this.subtotal.toFixed(2)}</b>
            </div>

            <div class="summary-line">
                <span>VAT (${this.VAT}%)</span>
                <b>${currency} ${this.vatAmount.toFixed(2)}</b>
            </div>

            <div class="summary-line">
                <span>Additional Charges (${this.EXTRA}%)</span>
                <b>${currency} ${this.extraAmount.toFixed(2)}</b>
            </div>

            <div class="summary-total">
                <span>Grand Total</span>
                <b>${currency} ${this.grandTotal.toFixed(2)}</b>
            </div>
        `;

        document.getElementById("orderSummary").innerHTML = html;
    },

    /* ================= FORM ================= */
    getFormData() {

        return {
            FullName: document.getElementById("cName").value,
            Email: document.getElementById("cEmail").value,
            Phone: document.getElementById("cPhone").value,
            AddressLine1: document.getElementById("cAddress1").value,
            AddressLine2: document.getElementById("cAddress2").value,
            City: document.getElementById("cCity").value,
            State: document.getElementById("cState").value,
            Country: document.getElementById("cCountry").value,
            PostalCode: document.getElementById("cPostal").value
        };
    },

    /* ================= VALIDATION ================= */
    validate() {

        const f = this.getFormData();

        if (!f.FullName || !f.Email || !f.Phone) {
            CustomerApp.toast("Name, Email, Phone required", "error");
            return false;
        }

        return true;
    },

    /* ================= PLACE ORDER ================= */
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

                CustomerApp.toast("Order placed successfully", "success");

                localStorage.removeItem("cart");

                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1000);
            }

        } catch (err) {
            CustomerApp.toast("Order failed", "error");
        }
    }
};

window.onload = () => Checkout.init();