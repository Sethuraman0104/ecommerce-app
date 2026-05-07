const Payments = {

    DATA: [],

    async init() {

        await App.READY_PROMISE;

        await this.load();

        document.getElementById("searchBox")?.addEventListener("input", () => this.render());
        document.getElementById("statusFilter")?.addEventListener("change", () => this.render());
        document.getElementById("methodFilter")?.addEventListener("change", () => this.render());
    },

    async load() {
        this.DATA = await App.api("/payments") || [];
        this.render();
    },

    render() {

    const tbody = document.getElementById("paymentTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    const symbol = App.CURRENCY_SYMBOL ?? "$";

    if (!this.DATA.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div class="empty-box">
                        <i class="fa fa-credit-card"></i>
                        <h3>No Payments Found</h3>
                        <p>Payments will appear here once orders are processed.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    this.DATA.forEach(p => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>#${p.PaymentID}</td>
            <td>#${p.OrderID}</td>
            <td>${p.CustomerName || "-"}</td>

            <td>${symbol}${Number(p.Amount || 0).toFixed(2)}</td>

            <td>${p.PaymentMethod}</td>

            <td>
                <span class="ord-badge ord-pay-${(p.PaymentStatus || "").toLowerCase()}">
                    ${p.PaymentStatus}
                </span>
            </td>

            <td>${p.TransactionID || "-"}</td>
            <td>${p.PaidAt ? App.formatDate(p.PaidAt) : "-"}</td>

            <td>
                <button class="btnx-icon btnx-glass"
                    onclick="Payments.openModal(${p.PaymentID})">
                    <i class="fa fa-pen"></i>
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
},

    // =========================
    // MODAL
    // =========================
    async openModal(id) {

    const p = this.DATA.find(x => x.PaymentID === id);

    document.getElementById("payId").value = id;
    document.getElementById("payRemarks").value = "";

    const symbol = App.CURRENCY_SYMBOL ?? "$";

    // =========================
    // PAYMENT SUMMARY
    // =========================
    document.getElementById("paySummary").innerHTML = `
        <div><b>Order:</b> #${p.OrderID}</div>
        <div><b>Customer:</b> ${p.CustomerName || "-"}</div>

        <hr>

        <div><b>Subtotal:</b> ${symbol}${Number(p.SubTotal || 0).toFixed(2)}</div>

        <div><b>VAT (${p.VATPercent || 0}%):</b> ${symbol}${Number(p.VATAmount || 0).toFixed(2)}</div>

        <div><b>Additional (${p.AdditionalPercent || 0}%):</b> ${symbol}${Number(p.AdditionalAmount || 0).toFixed(2)}</div>

        <div><b>Discount (${p.DiscountPercent || 0}%):</b> -${symbol}${Number(p.DiscountAmount || 0).toFixed(2)}</div>

        <hr>

        <div style="font-size:16px;font-weight:bold;">
            Grand Total: ${symbol}${Number(p.Amount || 0).toFixed(2)}
        </div>
    `;

    document.getElementById("paymentModal").classList.add("show");

    await this.loadHistory(id);
},

    closeModal() {
        document.getElementById("paymentModal").classList.remove("show");
    },

    // =========================
    // HISTORY
    // =========================
    async loadHistory(id) {

        const data = await App.api(`/payments/${id}/history`);

        const div = document.getElementById("payHistory");

        if (!data.length) {
            div.innerHTML = `
                <div class="empty-history">
                    <i class="fa fa-clock"></i>
                    <p>No status history found</p>
                </div>
            `;
            return;
        }

        div.innerHTML = data.map(h => `
            <div class="remark-item">
                <b>${h.OldStatus || "New"} → ${h.NewStatus}</b>
                <div>${h.Remarks}</div>
                <small>${App.formatDate(h.ChangedAt)}</small>
            </div>
        `).join("");
    },

    // =========================
    // SAVE STATUS
    // =========================
    async saveStatus() {

        const id = document.getElementById("payId").value;
        const status = document.getElementById("payStatus").value;
        const remarks = document.getElementById("payRemarks").value.trim();

        if (!remarks) {
            App.toast("Remarks is required", "error");
            return;
        }

        await App.api(`/payments/${id}/status`, "PUT", {
            status,
            remarks
        });

        App.toast("Payment updated successfully", "success");

        this.closeModal();
        this.load();
    }
};