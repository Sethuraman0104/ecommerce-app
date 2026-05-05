const Orders = {

    DATA: [],
    currentOrderId: null,

    init() {
        this.load();
        this.bindEvents();
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
                        onchange="Orders.openUpdateModal(${o.OrderID}, this.value)">
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
    // OPEN UPDATE MODAL (FIXED FLOW)
    // =========================
    async openUpdateModal(orderId, status) {

        this.currentOrderId = orderId;

        const order = this.DATA.find(x => x.OrderID === orderId);

        document.getElementById("updateOrderTitle").innerText =
            `Order #${orderId}`;

        document.getElementById("updateStatus").value = status;
        document.getElementById("updateRemarks").value = "";

        await this.loadRemarksHistory(orderId);

        document.getElementById("orderUpdateModal").classList.add("show");
    },

    closeUpdateModal() {
        document.getElementById("orderUpdateModal").classList.remove("show");
    },

    // =========================
    // SAVE UPDATE (STATUS + REMARKS)
    // =========================
    async submitUpdate() {

        const status = document.getElementById("updateStatus").value;
        const remarks = document.getElementById("updateRemarks").value;

        if (!this.currentOrderId) return;

        await App.api(`/orders/${this.currentOrderId}/status`, "PUT", {
            status,
            adminRemarks: remarks
        });

        App.toast("Order updated successfully", "success");

        this.closeUpdateModal();
        this.load();
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

        document.getElementById("ordItemsList").innerHTML =
            res.items.map(i => `
                <div class="ord-item">
                    <span>${i.ProductName} x${i.Quantity}</span>
                    <b>${App.CURRENCY_SYMBOL}${i.LineTotal}</b>
                </div>
            `).join("");

        document.getElementById("ordPaymentInfo").innerHTML = `
            <div><b>Status:</b> ${res.payment?.PaymentStatus || "-"}</div>
            <div><b>Method:</b> ${res.payment?.PaymentMethod || "-"}</div>
            <div><b>Transaction:</b> ${res.payment?.TransactionID || "-"}</div>
        `;

        document.getElementById("ordModal").classList.add("show");
    },

    closeModal() {
        document.getElementById("ordModal").classList.remove("show");
    },

    // =========================
    // PRINT
    // =========================
    async printSingle(id) {

        const res = await App.api(`/orders/${id}/details`);
        const o = res.order;

        const companyName = document.getElementById("companyName")?.innerText || "Company";
        const logo = document.getElementById("companyLogo")?.src || "";

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
.total { margin-top:20px; text-align:right; font-size:20px; font-weight:bold; }
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
<td class="right">${App.CURRENCY_SYMBOL}${i.Price}</td>
<td class="right">${App.CURRENCY_SYMBOL}${i.LineTotal}</td>
</tr>
`).join("")}
</tbody>
</table>

<div class="total">
Total: ${App.CURRENCY_SYMBOL}${o.TotalAmount}
</div>

</body>
</html>
`;

        win.document.open();
        win.document.write(html);
        win.document.close();
    }
};