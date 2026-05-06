const Coupons = {

    DATA: [],
    editId: null,

    init() {
        this.bindEvents();
        this.load();
    },

    bindEvents() {
        document.getElementById("couponSearch")
            ?.addEventListener("input", () => this.render());

        document.getElementById("couponStatusFilter")
            ?.addEventListener("change", () => this.render());
    },

    async load() {
        this.DATA = await App.api("/coupons") || [];
        this.render();
    },

    // ================= FILTER LOGIC
    filter() {

    let data = [...this.DATA];

    const search = document.getElementById("couponSearch")?.value.toLowerCase() || "";
    const status = document.getElementById("couponStatusFilter")?.value;

    // SEARCH
    if (search) {
        data = data.filter(c =>
            (c.Code || "").toLowerCase().includes(search)
        );
    }

    // STATUS FIX (IMPORTANT)
    if (status !== "") {

        const isActiveFilter = status === "1"; // convert to boolean

        data = data.filter(c =>
            Boolean(c.IsActive) === isActiveFilter
        );
    }

    return data;
},

    render() {

        const tbody = document.getElementById("couponTable");
        const data = this.filter();

        if (!data.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:30px;">
                        <i class="fa fa-tag"></i>
                        <div>No Coupons Found</div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.map(c => `

            <tr>
                <td><b>${c.Code}</b></td>

                <td>${c.DiscountPercent}%</td>

                <td>${App.formatDate(c.ExpiryDate)}</td>

                <td>
                    <span class="ord-badge ${c.IsActive ? 'ord-pay-paid' : 'ord-pay-failed'}">
                        ${c.IsActive ? 'Active' : 'Inactive'}
                    </span>
                </td>

                <td style="display:flex; gap:6px;">

    <button class="btnx-icon btnx-success"
        onclick="Coupons.viewUsage(${c.CouponID})"
        title="View Usage">
        <i class="fa fa-chart-line"></i>
    </button>

    <button class="btnx-icon btnx-primary"
        onclick="Coupons.edit(${c.CouponID})">
        <i class="fa fa-edit"></i>
    </button>

    <button class="btnx-icon btnx-glass"
        onclick="Coupons.toggle(${c.CouponID})">
        <i class="fa fa-sync"></i>
    </button>

    <button class="btnx-icon btnx-danger"
        onclick="Coupons.delete(${c.CouponID})">
        <i class="fa fa-trash"></i>
    </button>

</td>
            </tr>

        `).join("");
    },

    async save(e) {

        const btn = e.target;
        btn.disabled = true;
        btn.innerHTML = "Saving...";

        try {

            const payload = {
                id: this.editId,
                code: document.getElementById("cCode").value.trim(),
                discount: parseInt(document.getElementById("cDiscount").value),
                expiry: document.getElementById("cExpiry").value
            };

            await App.api("/coupons", "POST", payload);

            App.toast("Saved successfully", "success");

            this.reset();
            this.load();

        } catch (err) {
            App.toast(err.message, "error");
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Save Coupon';
    },
async viewUsage(id) {

    const data = await App.api(`/coupons/${id}/usage`);

    const box = document.getElementById("couponUsageList");
    const modal = document.getElementById("couponUsageModal");

    if (!data.length) {
        box.innerHTML = "<div style='padding:20px;'>No usage found</div>";
        modal.classList.add("show");
        return;
    }

    box.innerHTML = data.map(o => {

        return `

        <div class="usage-card">

            <!-- HEADER -->
            <div class="usage-header">
                <div>
                    <b>Order #${o.OrderID}</b>
                    <div>${o.FullName || "Guest"}</div>
                    <small>${o.Email || ""}</small>
                </div>

                <div class="usage-right">
                    <div><b>${App.CURRENCY_SYMBOL}${o.TotalAmount}</b></div>
                    <span class="ord-badge ord-status-${(o.Status || "").toLowerCase()}">
                        ${o.Status}
                    </span>
                </div>
            </div>

            <!-- PRODUCTS -->
            <div class="usage-items">
                <h4>Products</h4>

                ${o.Items.map(i => `
                    <div class="usage-item">
                        <div>
                            <b>${i.ProductName || ("Product " + i.ProductID)}</b>
                            <small>Qty: ${i.Quantity}</small>
                        </div>
                        <b>${App.CURRENCY_SYMBOL}${i.LineTotal}</b>
                    </div>
                `).join("")}
            </div>

            <!-- PAYMENT SUMMARY -->
            <div class="usage-payment">

                <h4>Payment Summary</h4>

                <div class="pay-row">
                    <span>Method</span>
                    <b>${o.PaymentMethod || "-"}</b>
                </div>

                <div class="pay-row">
                    <span>Status</span>
                    <b>${o.PaymentStatus || "-"}</b>
                </div>

                <div class="pay-row">
                    <span>Transaction</span>
                    <b>${o.TransactionID || "-"}</b>
                </div>

                <hr>

                <!-- BILLING BREAKDOWN -->
                <div class="pay-row">
                    <span>Sub Total</span>
                    <b>${App.CURRENCY_SYMBOL}${o.SubTotal || 0}</b>
                </div>

                <div class="pay-row discount">
                    <span>Discount</span>
                    <b>- ${App.CURRENCY_SYMBOL}${o.DiscountAmount || 0}</b>
                </div>

                <div class="pay-row">
                    <span>VAT (${o.VATPercent || 0}%)</span>
                    <b>${App.CURRENCY_SYMBOL}${o.VATAmount || 0}</b>
                </div>

                <div class="pay-row">
                    <span>Additional (${o.AdditionalPercent || 0}%)</span>
                    <b>${App.CURRENCY_SYMBOL}${o.AdditionalAmount || 0}</b>
                </div>

                <div class="pay-row total">
                    <span>Total</span>
                    <b>${App.CURRENCY_SYMBOL}${o.TotalAmount || 0}</b>
                </div>

            </div>

            <!-- FOOTER -->
            <div class="usage-footer">
                <small>${App.formatDate(o.CreatedAt)}</small>
            </div>

        </div>

        `;
    }).join("");

    modal.classList.add("show");
},

closeUsageModal() {
    document.getElementById("couponUsageModal").classList.remove("show");
},

    edit(id) {

        const c = this.DATA.find(x => x.CouponID === id);

        this.editId = id;

        document.getElementById("cCode").value = c.Code;
        document.getElementById("cDiscount").value = c.DiscountPercent;
        document.getElementById("cExpiry").value = c.ExpiryDate?.split("T")[0];
    },

    async toggle(id) {
        await App.api(`/coupons/${id}/toggle`, "PUT");
        this.load();
    },

    async delete(id) {

        if (!confirm("Delete this coupon?")) return;

        await App.api(`/coupons/${id}`, "DELETE");

        App.toast("Deleted", "success");
        this.load();
    },

    reset() {
        this.editId = null;
        document.getElementById("cCode").value = "";
        document.getElementById("cDiscount").value = "";
        document.getElementById("cExpiry").value = "";
    }
};