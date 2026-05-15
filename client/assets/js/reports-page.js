let currentReport = "";
let currentData = [];
let filteredData = [];

/* =========================
   REPORT LIST
========================= */

const reports = [
    { key: "daily-sales", name: "Daily Sales", desc: "Revenue and order statistics" },
    { key: "monthly-sales", name: "Monthly Sales", desc: "Monthly performance analytics" },
    { key: "top-products", name: "Top Products", desc: "Most sold products report" },
    { key: "low-stock", name: "Low Stock", desc: "Inventory alerts and monitoring" },
    { key: "customers", name: "Customers", desc: "Customer database analytics" },
    { key: "payments", name: "Payments", desc: "Payment transactions report" },
    { key: "coupon-usage", name: "Coupon Usage", desc: "Discount usage analysis" },
    { key: "audit-logs", name: "Audit Logs", desc: "System activity tracking" }
];

/* =========================
   INIT
========================= */

document.addEventListener(
    "DOMContentLoaded",
    renderReportList
);

/* =========================
   REPORT LIST
========================= */

function renderReportList() {

    const body =
        document.getElementById("reportListBody");

    if (!body) return;

    body.innerHTML = reports.map(r => `

        <div class="report-card">

            <h3>${r.name}</h3>

            <p>${r.desc}</p>

            <div class="report-card-actions">

                <!-- VIEW -->

                <button class="view-btn"
                    onclick="openReport('${r.key}')">

                    <i class="fa fa-eye"></i>

                </button>

                <!-- EXCEL -->

                <button class="excel-btn"
                    onclick="quickExcel('${r.key}')">

                    <i class="fa fa-file-excel"></i>

                </button>

                <!-- PDF -->

                <button class="pdf-btn"
                    onclick="quickPDF('${r.key}')">

                    <i class="fa fa-file-pdf"></i>

                </button>

            </div>

        </div>

    `).join("");
}

/* =========================
   SEARCH REPORTS
========================= */

function filterReports() {

    const val =
        document.getElementById("reportSearch")
            .value
            .toLowerCase();

    document
        .querySelectorAll(".report-card")

        .forEach(card => {

            card.style.display =
                card.innerText
                    .toLowerCase()
                    .includes(val)

                    ? "block"
                    : "none";
        });
}

/* =========================
   LOAD REPORT DATA
========================= */

async function loadReportData(type) {

    try {

        currentReport = type;

        const res =
            await fetch(`/api/reports/${type}`);

        if (!res.ok) {
            throw new Error("Failed to load report");
        }

        const data =
            await res.json();

        currentData =
            Array.isArray(data)
                ? data
                : [];

        filteredData =
            [...currentData];

        console.log(
            "REPORT DATA => ",
            currentData
        );

        return currentData;

    } catch (err) {

        console.error(err);

        currentData = [];
        filteredData = [];

        alert("Failed to load report data");

        return [];
    }
}

/* =========================
   OPEN REPORT
========================= */

async function openReport(type) {

    document.getElementById("modalTitle")
        .innerText =
        formatColumn(type);

    document.getElementById("reportModal")
        .classList.add("active");

    const searchBox =
        document.getElementById("modalSearch");

    if (searchBox) {
        searchBox.value = "";
    }

    showLoader(true);

    try {

        const data =
            await loadReportData(type);

        renderTable(data);

    } finally {

        showLoader(false);
    }
}

/* =========================
   MODAL SEARCH
========================= */

function filterModalData() {

    const search =
        (
            document.getElementById("modalSearch")
                .value || ""
        )
            .toLowerCase();

    if (!search) {

        filteredData =
            [...currentData];

    } else {

        filteredData =
            currentData.filter(row =>

                Object.values(row).some(val =>

                    String(val ?? "")
                        .toLowerCase()
                        .includes(search)
                )
            );
    }

    renderTable(filteredData);
}

/* =========================
   TABLE RENDER
========================= */

function renderTable(data) {

    const head =
        document.getElementById("reportHead");

    const body =
        document.getElementById("reportBody");

    if (!head || !body) return;

    head.innerHTML = "";
    body.innerHTML = "";

    /* EMPTY */

    if (!data || data.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="100%" class="no-data">
                    No data available
                </td>
            </tr>
        `;

        return;
    }

    /* =========================
       AUDIT LOGS VIEW
    ========================== */

    if (currentReport === "audit-logs") {

        head.innerHTML = `
            <tr>
                <th style="width:60px;"></th>
                <th>Log ID</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Status</th>
                <th>Date</th>
            </tr>
        `;

        body.innerHTML = data.map((row, index) => {

            const oldValues =
                escapeHtml(
                    formatJson(row.OldValues)
                );

            const newValues =
                escapeHtml(
                    formatJson(row.NewValues)
                );

            const description =
                escapeHtml(
                    row.Description || "-"
                );

            const ipAddress =
                escapeHtml(
                    row.IPAddress || "-"
                );

            const userAgent =
                escapeHtml(
                    row.UserAgent || "-"
                );

            const userName =
                escapeHtml(
                    row.UserName || "Unknown"
                );

            const userType =
                escapeHtml(
                    row.UserType || ""
                );

            const module =
                escapeHtml(
                    row.Module || "-"
                );

            const actionType =
                escapeHtml(
                    row.ActionType || "-"
                );

            const status =
                escapeHtml(
                    row.Status || "-"
                );

            return `

                <tr class="audit-main-row">

                    <td>

                        <button class="audit-expand-btn"
                            onclick="toggleAuditRow(${index})">

                            <i class="fa fa-chevron-down"
                               id="auditIcon${index}"></i>

                        </button>

                    </td>

                    <td>
                        #${row.LogID || "-"}
                    </td>

                    <td>

                        <div class="audit-user">

                            <strong>
                                ${userName}
                            </strong>

                            <small>
                                ${userType}
                            </small>

                        </div>

                    </td>

                    <td>

                        <span class="audit-module">
                            ${module}
                        </span>

                    </td>

                    <td>

                        <span class="audit-action">
                            ${actionType}
                        </span>

                    </td>

                    <td>

                        <span class="audit-status ${String(row.Status || "").toLowerCase()}">

                            ${status}

                        </span>

                    </td>

                    <td>

                        ${formatCell("CreatedAt", row.CreatedAt)}

                    </td>

                </tr>

                <tr class="audit-expand-row hidden"
                    id="auditRow${index}">

                    <td colspan="7">

                        <div class="audit-details">

                            <div class="audit-detail-grid">

                                <div class="audit-box">

                                    <label>Description</label>

                                    <div class="audit-pre">
                                        ${description}
                                    </div>

                                </div>

                                <div class="audit-box">

                                    <label>Old Values</label>

                                    <div class="audit-pre">
                                        ${oldValues}
                                    </div>

                                </div>

                                <div class="audit-box">

                                    <label>New Values</label>

                                    <div class="audit-pre">
                                        ${newValues}
                                    </div>

                                </div>

                                <div class="audit-box">

                                    <label>IP Address</label>

                                    <div class="audit-pre">
                                        ${ipAddress}
                                    </div>

                                </div>

                                <div class="audit-box full-width">

                                    <label>Browser / Device</label>

                                    <div class="audit-pre">
                                        ${userAgent}
                                    </div>

                                </div>

                            </div>

                        </div>

                    </td>

                </tr>

            `;

        }).join("");

        return;
    }

    /* =========================
       NORMAL TABLE
    ========================== */

    const cols =
        Object.keys(data[0]);

    head.innerHTML = `
        <tr>

            ${cols.map(c => `
                <th>
                    ${formatColumn(c)}
                </th>
            `).join("")}

        </tr>
    `;

    body.innerHTML = data.map(row => `

        <tr>

            ${cols.map(c => `
                <td>
                    ${formatCell(c, row[c])}
                </td>
            `).join("")}

        </tr>

    `).join("");
}

/* =========================
   TOGGLE AUDIT ROW
========================= */

function toggleAuditRow(index) {

    const row =
        document.getElementById(`auditRow${index}`);

    const icon =
        document.getElementById(`auditIcon${index}`);

    if (!row || !icon) return;

    row.classList.toggle("hidden");

    if (row.classList.contains("hidden")) {

        icon.className =
            "fa fa-chevron-down";

    } else {

        icon.className =
            "fa fa-chevron-up";
    }
}

/* =========================
   FORMAT JSON
========================= */

function formatJson(value) {

    try {

        if (
            value === null ||
            value === undefined ||
            value === "" ||
            value === "null"
        ) {
            return "No data";
        }

        if (typeof value === "object") {

            return JSON.stringify(
                value,
                null,
                2
            );
        }

        let str =
            String(value).trim();

        str = str
            .replace(/\\"/g, '"')
            .replace(/^"(.*)"$/, '$1');

        const parsed =
            JSON.parse(str);

        return JSON.stringify(
            parsed,
            null,
            2
        );

    } catch (err) {

        return String(value || "No data");
    }
}

/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(text) {

    if (
        text === null ||
        text === undefined
    ) {
        return "";
    }

    return String(text)

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>")
        .replace(/\r/g, "")
        .replace(/ /g, "&nbsp;");
}

/* =========================
   FORMAT COLUMN
========================= */

function formatColumn(col) {

    if (!col) return "";

    return col
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, c => c.toUpperCase());
}

/* =========================
   FORMAT CELL
========================= */

function formatCell(column, value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "";
    }

    const col =
        String(column).toLowerCase();

    /* DATE */

    if (typeof value === "string") {

        const isDate =
            /^\d{4}-\d{2}-\d{2}/.test(value) ||
            value.includes("T");

        if (
            isDate &&
            !isNaN(Date.parse(value))
        ) {

            if (
                typeof App !== "undefined" &&
                App.formatDate
            ) {
                return App.formatDate(value);
            }

            return new Date(value)
                .toLocaleString();
        }
    }

    /* NON CURRENCY */

    const nonCurrencyCols = [
        "id",
        "userid",
        "paymentid",
        "orderid",
        "quantity",
        "qty",
        "count",
        "stock",
        "TotalOrders"
    ];

    if (
        nonCurrencyCols.some(x =>
            col.includes(x)
        )
    ) {
        return escapeHtml(value);
    }

    /* CURRENCY */

    const currencyCols = [
        "amount",
        "price",
        "total",
        "revenue",
        "salary",
        "cost",
        "discount",
        "balance",
        "paid"
    ];

    if (
        currencyCols.some(x =>
            col.includes(x)
        )
    ) {

        const num =
            Number(value);

        if (!isNaN(num)) {

            return `
                ${App?.CURRENCY_SYMBOL || "$"}
                ${num.toFixed(2)}
            `;
        }
    }

    return escapeHtml(value);
}

/* =========================
   MODAL
========================= */

function closeModal() {

    document.getElementById("reportModal")
        .classList.remove("active");
}

/* =========================
   LOADER
========================= */

function showLoader(show) {

    document.getElementById("modalLoader")
        .classList.toggle(
            "hidden",
            !show
        );
}

/* =========================
   QUICK EXCEL
========================= */

async function quickExcel(type) {

    showLoader(true);

    try {

        const data =
            await loadReportData(type);

        if (!data || data.length === 0) {

            alert("No data available");

            return;
        }

        window.open(
            `/api/reports/export/excel/${type}`,
            "_blank"
        );

    } finally {

        showLoader(false);
    }
}

/* =========================
   QUICK PDF
========================= */

async function quickPDF(type) {

    showLoader(true);

    try {

        const data =
            await loadReportData(type);

        if (!data || data.length === 0) {

            alert("No data available");

            return;
        }

        exportReportODF();

    } finally {

        showLoader(false);
    }
}

/* =========================
   DOWNLOAD EXCEL
========================= */

function downloadExcel() {

    if (!currentReport) {

        alert("No report selected");

        return;
    }

    quickExcel(currentReport);
}

/* =========================
   DOWNLOAD PDF
========================= */

function downloadPDF() {

    if (
        !currentReport ||
        !currentData ||
        currentData.length === 0
    ) {

        alert("No report data available");

        return;
    }

    exportReportODF();
}

/* =========================
   EXPORT REPORT ODF/PDF
========================= */

function exportReportODF() {

    if (
        !currentData ||
        currentData.length === 0
    ) {

        alert("No data to export");

        return;
    }

    const companyName =
        document.getElementById("companyName")
            ?.innerText || "Company";

    const logo =
        document.getElementById("companyLogo")
            ?.src || "";

    const title =
        formatColumn(currentReport);

    const columns =
        Object.keys(currentData[0]);

    const win =
        window.open("", "_blank");

    const html = `
<!DOCTYPE html>
<html>
<head>

<title>${title} Report</title>

<style>

body{
    font-family:Arial,sans-serif;
    margin:0;
    padding:30px;
    background:#f7f9fc;
    color:#222;
}

.header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    border-bottom:3px solid #1f4e79;
    padding-bottom:15px;
    margin-bottom:20px;
}

.header h1{
    margin:0;
    font-size:22px;
    color:#1f4e79;
}

.header small{
    color:#666;
}

.logo{
    height:60px;
    object-fit:contain;
}

.title{
    text-align:center;
    font-size:20px;
    font-weight:bold;
    margin:20px 0;
}

table{
    width:100%;
    border-collapse:collapse;
    background:#fff;
}

th{
    background:#1f4e79;
    color:#fff;
    padding:10px;
    text-align:left;
    font-size:13px;
}

td{
    border-bottom:1px solid #eee;
    padding:8px;
    font-size:12px;
}

tr:nth-child(even){
    background:#f9fbfd;
}

.footer{
    margin-top:30px;
    text-align:center;
    font-size:11px;
    color:#777;
}

</style>

</head>

<body>

<div class="header">

    <div class="company">

        <h1>${companyName}</h1>

        <small>
            Generated Report •
            ${new Date().toLocaleString()}
        </small>

    </div>

    <img src="${logo}" class="logo"/>

</div>

<div class="title">

    ${title} Report

</div>

<table>

<thead>

<tr>

${columns.map(c => `
    <th>${formatColumn(c)}</th>
`).join("")}

</tr>

</thead>

<tbody>

${currentData.map(row => `

<tr>

${columns.map(c => `

<td>

${formatCell(c, row[c])}

</td>

`).join("")}

</tr>

`).join("")}

</tbody>

</table>

<div class="footer">

    © ${new Date().getFullYear()}
    ${companyName}
    • Confidential Report

</div>

</body>
</html>
`;

    win.document.open();
    win.document.write(html);
    win.document.close();
}