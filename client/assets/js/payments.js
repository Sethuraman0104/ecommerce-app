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
        tbody.innerHTML = "";

        const symbol = App.CURRENCY_SYMBOL || "$";

        this.DATA.forEach(p => {

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>#${p.PaymentID}</td>
                <td>#${p.OrderID}</td>
                <td>${p.CustomerName}</td>
                <td>${symbol} ${(p.Amount || 0).toFixed(2)}</td>
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

        document.getElementById("payId").value = id;
        document.getElementById("payRemarks").value = "";

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
            div.innerHTML = "<p>No history</p>";
            return;
        }

        div.innerHTML = data.map(h => `
            <div class="remark-item">
                <b>${h.OldStatus} → ${h.NewStatus}</b>
                <div>${h.Remarks}</div>
                <small>${App.formatDate(h.ChangedAt)}</small>
            </div>
        `).join("");
    },

    // =========================
    // SAVE
    // =========================
    async saveStatus() {

        const id = document.getElementById("payId").value;
        const status = document.getElementById("payStatus").value;
        const remarks = document.getElementById("payRemarks").value.trim();

        if (!remarks) {
            App.toast("Remarks required", "error");
            return;
        }

        await App.api(`/payments/${id}/status`, "PUT", {
            status,
            remarks
        });

        App.toast("Updated successfully", "success");

        this.closeModal();
        this.load();
    }
};