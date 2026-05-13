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

document.addEventListener("DOMContentLoaded", renderReportList);

function renderReportList() {

    const body = document.getElementById("reportListBody");

    body.innerHTML = reports.map(r => `
        <div class="report-card">

            <h3>${r.name}</h3>
            <p>${r.desc}</p>

            <div class="report-card-actions">

                <button class="view-btn" onclick="openReport('${r.key}')">
                    <i class="fa fa-eye"></i>
                </button>

                <button class="excel-btn" onclick="quickExcel('${r.key}')">
                    <i class="fa fa-file-excel"></i>
                </button>

                <button class="pdf-btn" onclick="quickPDF('${r.key}')">
                    <i class="fa fa-file-pdf"></i>
                </button>

            </div>

        </div>
    `).join("");
}

/* =========================
   SEARCH REPORTS (GRID)
========================= */

function filterReports() {

    const val = document.getElementById("reportSearch").value.toLowerCase();

    document.querySelectorAll(".report-card").forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(val)
            ? "block"
            : "none";
    });
}

/* =========================
   OPEN REPORT
========================= */

async function openReport(type) {

    currentReport = type;

    document.getElementById("modalTitle").innerText =
        formatColumn(type);

    document.getElementById("reportModal").classList.add("active");

    // reset modal search
    const searchBox = document.getElementById("modalSearch");
    if (searchBox) searchBox.value = "";

    showLoader(true);

    try {

        const res = await fetch(`/api/reports/${type}`);
        const data = await res.json();

        currentData = Array.isArray(data) ? data : [];
        filteredData = [...currentData];

        renderTable(filteredData);

    } catch (err) {

        console.error(err);
        renderTable([]);

    } finally {
        showLoader(false);
    }
}

/* =========================
   MODAL SEARCH (NEW)
========================= */

function filterModalData() {

    const search = (document.getElementById("modalSearch").value || "")
        .toLowerCase();

    if (!search) {
        filteredData = [...currentData];
    } else {
        filteredData = currentData.filter(row =>
            Object.values(row).some(val =>
                String(val ?? "").toLowerCase().includes(search)
            )
        );
    }

    renderTable(filteredData);
}

/* =========================
   TABLE RENDER
========================= */

function renderTable(data) {

    const head = document.getElementById("reportHead");
    const body = document.getElementById("reportBody");

    head.innerHTML = "";
    body.innerHTML = "";

    if (!data || data.length === 0) {
        body.innerHTML = `<tr><td colspan="100%">No data available</td></tr>`;
        return;
    }

    const cols = Object.keys(data[0]);

    head.innerHTML = `
        <tr>
            ${cols.map(c => `<th>${formatColumn(c)}</th>`).join("")}
        </tr>
    `;

    body.innerHTML = data.map(row => `
        <tr>
            ${cols.map(c => `
                <td>${formatCell(c, row[c])}</td>
            `).join("")}
        </tr>
    `).join("");
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

    if (value === null || value === undefined || value === "") return "";

    const col = column.toLowerCase();

    /* DATE */
    if (typeof value === "string") {

        const isDate =
            /^\d{4}-\d{2}-\d{2}/.test(value) ||
            value.includes("T");

        if (isDate && !isNaN(Date.parse(value))) {
            return App.formatDate(value);
        }
    }

    /* CURRENCY */
    const currencyCols = [
        "amount", "price", "total", "revenue",
        "salary", "cost", "payment", "paid",
        "balance", "discount"
    ];

    if (currencyCols.some(x => col.includes(x))) {

        const num = Number(value);

        if (!isNaN(num)) {
            return `${App.CURRENCY_SYMBOL || "$"} ${num.toFixed(2)}`;
        }
    }

    return value;
}

/* =========================
   MODAL CONTROL
========================= */

function closeModal() {
    document.getElementById("reportModal").classList.remove("active");
}

/* =========================
   LOADER
========================= */

function showLoader(show) {
    document.getElementById("modalLoader")
        .classList.toggle("hidden", !show);
}

/* =========================
   EXPORT
========================= */

function quickExcel(type) {
    window.open(`/api/reports/export/excel/${type}`, "_blank");
}

function quickPDF(type) {
    window.open(`/api/reports/export/pdf/${type}`, "_blank");
}

function downloadExcel() {
    if (currentReport) quickExcel(currentReport);
}

function downloadPDF() {
    if (currentReport) quickPDF(currentReport);
}