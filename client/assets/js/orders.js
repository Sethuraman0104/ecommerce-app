const Orders = {

    DATA: [],
    currentOrderId: null,

    init() {
        this.bindEvents();
        this.waitForApp();
    },
    async waitForApp() {
        await App.READY_PROMISE;   // 🔥 WAIT until currency + settings loaded
        await this.load();
    },

    bindEvents() {

        document.getElementById("searchBox")?.addEventListener("input", () => this.render());
        document.getElementById("statusFilter")?.addEventListener("change", () => this.render());
        document.getElementById("paymentFilter")?.addEventListener("change", () => this.render());
    },

    async load() {
        this.DATA = await App.api("/orders") || [];
        this.render();
    },

    filter() {

        let data = [...this.DATA];

        const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
        const status = document.getElementById("statusFilter")?.value || "";
        const payment = document.getElementById("paymentFilter")?.value || "";

        if (search) {
            data = data.filter(x =>
                x.CustomerName?.toLowerCase().includes(search) ||
                String(x.OrderID).includes(search)
            );
        }

        if (status) data = data.filter(x => x.Status === status);
        if (payment) data = data.filter(x => x.PaymentStatus === payment);

        return data;
    },

    render() {

        const tbody = document.getElementById("ordTableBody");
        tbody.innerHTML = "";

        const data = this.filter();

        if (!data.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="ord-empty">
                        <i class="fa fa-box-open"></i>
                        <div>No Orders Found</div>
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(o => {

            const canDelete =
                o.Status === "Cancelled" &&
                (o.PaymentStatus || "").toLowerCase() === "failed";

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td class="ord-id">#${o.OrderID}</td>

                <td class="ord-customer">
                    <div class="ord-name">${o.CustomerName || "Guest"}</div>
                    <div class="ord-email">${o.Email || ""}</div>
                </td>

                <td class="ord-total">
                    ${App.CURRENCY_SYMBOL}${parseFloat(o.TotalAmount || 0).toFixed(2)}
                </td>

                <td>
                    <select class="ord-status-select"
    onchange="Orders.openUpdateModal(${o.OrderID}, this.value, this)">
    <option ${o.Status === "Pending" ? "selected" : ""}>Pending</option>
    <option ${o.Status === "Processing" ? "selected" : ""}>Processing</option>
    <option ${o.Status === "Shipped" ? "selected" : ""}>Shipped</option>
    <option ${o.Status === "Delivered" ? "selected" : ""}>Delivered</option>
    <option ${o.Status === "Cancelled" ? "selected" : ""}>Cancelled</option>
</select>
                </td>

                <td>
                    <span class="ord-badge ord-pay-${(o.PaymentStatus || "pending").toLowerCase()}">
                        ${o.PaymentStatus || "Pending"}
                    </span>
                </td>

                <td>${o.TransactionID || "-"}</td>

                <!-- CUSTOMER + ADMIN REMARKS -->
                <td>
                    <div style="font-size:12px;">
                        <b>C:</b> ${o.CustomerRemarks || "-"}
                    </div>
                    <div style="font-size:12px; color:#555;">
                        <b>A:</b> ${o.AdminRemarks || "-"}
                    </div>
                </td>

                <td>${App.formatDate(o.CreatedAt)}</td>

                <td>
                    <div style="display:flex; gap:6px;">

                        <button class="btnx-icon btnx-glass" onclick="Orders.view(${o.OrderID})">
                            <i class="fa fa-eye"></i>
                        </button>

                        <button class="btnx-icon btnx-success" onclick="Orders.printSingle(${o.OrderID})">
                            <i class="fa fa-print"></i>
                        </button>

                        <button class="btnx-icon btnx-danger ${!canDelete ? 'disabled' : ''}"
                            ${!canDelete ? 'disabled' : `onclick="Orders.delete(${o.OrderID})"`}>
                            <i class="fa fa-trash"></i>
                        </button>

                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    },

    // =========================
    // DELETE
    // =========================
    async delete(id) {

        if (!confirm("Are you sure you want to delete this order?")) return;

        try {
            await App.api(`/orders/${id}`, "DELETE");

            App.toast("Order deleted successfully", "success");
            this.load();

        } catch (err) {
            App.toast(err.message || "Delete failed", "error");
        }
    },

    // =========================
    // OPEN MODAL
    // =========================
    async openUpdateModal(orderId, selectedStatus, el) {

        this.currentOrderId = orderId;

        const order = this.DATA.find(x => x.OrderID === orderId);

        // ✅ IMPORTANT: use clicked value (NOT DB overwrite)
        this.previousStatus = order?.Status || selectedStatus;

        this.currentStatusElement = el;

        document.getElementById("updateOrderTitle").innerText =
            `Order #${orderId}`;

        // 🔥 THIS is the fix — show correct selected value
        document.getElementById("updateStatus").value = selectedStatus;

        document.getElementById("updateRemarks").value = "";

        await this.loadRemarksHistory(orderId);

        document.getElementById("orderUpdateModal").classList.add("show");
    },

    // =========================
    // CANCEL MODAL (RESTORE UI)
    // =========================
    closeUpdateModal() {

        document.getElementById("orderUpdateModal").classList.remove("show");

        // 🔥 restore UI dropdown ONLY
        if (this.currentStatusElement && this.previousStatus !== null) {
            this.currentStatusElement.value = this.previousStatus;
        }

        this.currentOrderId = null;
        this.currentStatusElement = null;
        this.previousStatus = null;
    },

    // =========================
    // SAVE UPDATE (STATUS + REMARKS)
    // =========================
    async submitUpdate() {

        const status = document.getElementById("updateStatus").value;
        const remarks = document.getElementById("updateRemarks").value;

        if (!this.currentOrderId) return;

        if (!remarks || remarks.trim() === "") {
            App.toast("Admin remarks are required", "error");
            document.getElementById("updateRemarks").focus();
            return;
        }

        try {

            await App.api(`/orders/${this.currentOrderId}/status`, "PUT", {
                status,
                adminRemarks: remarks.trim()
            });

            // 🔥 update local DATA so UI stays consistent
            const order = this.DATA.find(x => x.OrderID === this.currentOrderId);
            if (order) order.Status = status;

            App.toast("Order updated successfully", "success");

            this.closeUpdateModal();
            this.render(); // IMPORTANT (refresh UI)

        } catch (err) {
            console.error(err);
            App.toast("Failed to update order", "error");
        }
    },

    // =========================
    // REMARKS HISTORY
    // =========================
    async loadRemarksHistory(orderId) {

        const data = await App.api(`/orders/${orderId}/remarks`);

        const box = document.getElementById("remarksHistory");

        if (!data || !data.length) {
            box.innerHTML = "<div>No history found</div>";
            return;
        }

        box.innerHTML = data.map(r => `
            <div class="remark-item">
                <div><b>${r.Status}</b> - ${r.CreatedBy}</div>
                <div>${r.Remarks || ""}</div>
                <small>${App.formatDate(r.CreatedAt)}</small>
            </div>
        `).join("");
    },

    // =========================
    // VIEW DETAILS
    // =========================
    async view(id) {

        const res = await App.api(`/orders/${id}/details`);
        const o = res.order;

        document.getElementById("ordModalTitle").innerText =
            `Order #${o.OrderID}`;

        document.getElementById("ordModalSub").innerText =
            `${o.Status} • ${App.formatDate(o.CreatedAt)}`;

        // ================= CUSTOMER =================
        document.getElementById("ordCustomerInfo").innerHTML = `
        <div><b>${o.FullName}</b></div>
        <div>${o.Phone || ""}</div>
        <div>${o.AddressLine1 || ""}, ${o.City || ""}</div>
        <div>${o.Country || ""}</div>

        <hr>

        <div><b>Customer Remarks:</b></div>
        <div>${o.CustomerRemarks || "-"}</div>

        <div style="margin-top:8px;"><b>Admin Remarks:</b></div>
        <div>${o.AdminRemarks || "-"}</div>
    `;

        // ================= ITEMS =================
        document.getElementById("ordItemsList").innerHTML =
            res.items.map(i => `
            <div class="ord-item">
                <span>${i.ProductName} x${i.Quantity}</span>
                <b>${App.CURRENCY_SYMBOL}${i.LineTotal.toFixed(2)}</b>
            </div>
        `).join("");

        // ================= PAYMENT SUMMARY (NEW) =================
        const currency = App.CURRENCY_SYMBOL;

        document.getElementById("ordPaymentInfo").innerHTML = `

        <div class="pay-line"><b>Payment Method:</b> ${res.payment?.PaymentMethod || "-"}</div>
        <div class="pay-line"><b>Status:</b> ${res.payment?.PaymentStatus || "-"}</div>
        <div class="pay-line"><b>Transaction:</b> ${res.payment?.TransactionID || "-"}</div>

        <hr>

        <div class="pay-line"><b>Subtotal:</b> ${currency}${(o.TotalAmount - (o.VATAmount + o.AdditionalAmount - o.DiscountAmount)).toFixed(2)}</div>

        <div class="pay-line">
            <b>VAT (${o.VATPercent || 0}%):</b> ${currency}${(o.VATAmount || 0).toFixed(2)}
        </div>

        <div class="pay-line">
            <b>Additional (${o.AdditionalPercent || 0}%):</b> ${currency}${(o.AdditionalAmount || 0).toFixed(2)}
        </div>

        <div class="pay-line">
            <b>Discount:</b> - ${currency}${(o.DiscountAmount || 0).toFixed(2)}
        </div>

        <hr>

        <div class="pay-total">
            <b>Grand Total:</b> ${currency}${o.TotalAmount.toFixed(2)}
        </div>
    `;

        document.getElementById("ordModal").classList.add("show");
    },

    closeModal() {
        document.getElementById("ordModal").classList.remove("show");
    },

    // =========================
    // PRINT
    // =========================
    // =========================
// PRINT
// =========================
async printSingle(id) {

    const res = await App.api(`/orders/${id}/details`);
    const o = res.order;

    const companyName = document.getElementById("companyName")?.innerText || "Company";
    const logo = document.getElementById("companyLogo")?.src || "";

    const currency = App.CURRENCY_SYMBOL || "BD";

    const subtotal =
        (o.TotalAmount || 0)
        - ((o.VATAmount || 0) + (o.AdditionalAmount || 0))
        + (o.DiscountAmount || 0);

    const win = window.open("", "_blank");

    const html = `
<html>
<head>
<title>Invoice ${o.OrderID}</title>

<style>
body { font-family: Arial; padding: 40px; }

.header { display:flex; justify-content:space-between; }
.logo { height:60px; }

table { width:100%; border-collapse:collapse; margin-top:10px; }
th, td { border:1px solid #ccc; padding:8px; }
th { background:#f3f4f6; }

.right { text-align:right; }

.section-title {
    margin-top: 20px;
    font-size: 16px;
    font-weight: bold;
}

.summary-box {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #ddd;
    background: #fafafa;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    margin: 6px 0;
}

.total {
    margin-top: 20px;
    text-align:right;
    font-size:20px;
    font-weight:bold;
}
</style>

</head>
<body>

<div class="header">
    <div>
        <h2>${companyName}</h2>
        <small>Manama, Bahrain</small>
    </div>
    <img src="${logo}" class="logo"/>
</div>

<hr>

<h2>Invoice</h2>

<p>
<b>Order #${o.OrderID}</b><br>
Date: ${App.formatDate(o.CreatedAt)}<br>
Status: ${o.Status}
</p>

<h3>Customer</h3>
<p>
${o.FullName || ""}<br>
${o.Phone || ""}<br>
${o.AddressLine1 || ""}, ${o.City || ""}
</p>

<h3>Items</h3>

<table>
<thead>
<tr>
<th>Product</th>
<th>Qty</th>
<th>Price</th>
<th>Total</th>
</tr>
</thead>

<tbody>
${res.items.map(i => `
<tr>
<td>${i.ProductName}</td>
<td class="right">${i.Quantity}</td>
<td class="right">${currency}${parseFloat(i.Price).toFixed(2)}</td>
<td class="right">${currency}${parseFloat(i.LineTotal).toFixed(2)}</td>
</tr>
`).join("")}
</tbody>
</table>

<!-- ================= PAYMENT SUMMARY ================= -->
<div class="summary-box">

    <div class="section-title">Payment Summary</div>

    <div class="summary-row">
        <span>Subtotal</span>
        <span>${currency}${parseFloat(subtotal || 0).toFixed(2)}</span>
    </div>

    <div class="summary-row">
        <span>VAT (${o.VATPercent || 0}%)</span>
        <span>${currency}${parseFloat(o.VATAmount || 0).toFixed(2)}</span>
    </div>

    <div class="summary-row">
        <span>Additional Charges (${o.AdditionalPercent || 0}%)</span>
        <span>${currency}${parseFloat(o.AdditionalAmount || 0).toFixed(2)}</span>
    </div>

    <div class="summary-row">
        <span>Discount</span>
        <span>- ${currency}${parseFloat(o.DiscountAmount || 0).toFixed(2)}</span>
    </div>

    <hr>

    <div class="summary-row total">
        <span>Grand Total</span>
        <span>${currency}${parseFloat(o.TotalAmount || 0).toFixed(2)}</span>
    </div>

</div>

</body>
</html>
`;

    win.document.open();
    win.document.write(html);
    win.document.close();
}
};