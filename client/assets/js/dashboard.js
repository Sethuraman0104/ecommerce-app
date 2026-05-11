// INIT
function initDashboard() {
    checkAuth();
    loadUser();
    loadCompany();
}

// AUTH
function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../admin-login.html";
    }
}

// =========================
// USER
// =========================
async function loadUser() {

    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${CONFIG.API_BASE}/profile`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        /* =========================
           NAME
        ========================= */
        document.getElementById("userName").innerText =
            data.Name || localStorage.getItem("name") || "Admin";

        /* =========================
           ROLE
        ========================= */
        document.getElementById("userRole").innerText =
            localStorage.getItem("role") || "User";

        /* =========================
           PHOTO
        ========================= */
        if (data.Photo) {
            document.getElementById("userPhoto").src = data.Photo;
        }

        /* =========================
           LAST LOGIN (FIXED FORMAT)
           dd/MMM/yyyy HH:MM AM/PM
        ========================= */
        if (data.LastLogin) {

            const formattedDate = formatDateTime(data.LastLogin);

            document.getElementById("lastLogin").innerText =
                "Last login: " + formattedDate;

        } else {
            document.getElementById("lastLogin").innerText =
                "Last login: First login";
        }

    } catch (err) {
        console.error("User load failed:", err);

        document.getElementById("userName").innerText = "Admin";
        document.getElementById("lastLogin").innerText = "Last login: -";
    }
}

function formatDateTime(dateString) {

    // prevent timezone shift by forcing raw parsing
    const parts = dateString.split(/[- : T .]/);

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const hour = parseInt(parts[3]);
    const minute = parseInt(parts[4]);

    const date = new Date(year, month, day, hour, minute);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");

    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;

    return (
        String(date.getDate()).padStart(2, "0") + "/" +
        months[date.getMonth()] + "/" +
        date.getFullYear() + " " +
        h + ":" + m + " " + ampm
    );
}

// =========================
// COMPANY + APP BRANDING (FINAL PRO)
// =========================
async function loadCompany() {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/public/app-info`);

        if (!res.ok) throw new Error("API not reachable");

        const data = await res.json();

        /* =========================
           SAFE DATA MAPPING
        ========================= */
        const companyName =
            data.Name || data.company?.Name || "E-Shop";

        const logo =
            data.Logo || data.company?.Logo || "../assets/logo.png";

        const copyrightCompany =
            data.Copyright ||
            data.copyrightCompany ||
            companyName;

        const developedBy =
            data.DevelopedBy ||
            data.developedBy ||
            "HR Info";

        /* =========================
           HEADER / SIDEBAR
        ========================= */
        const nameEl = document.getElementById("companyName");
        if (nameEl) nameEl.innerText = companyName;

        const logoEl = document.getElementById("companyLogo");
        if (logoEl && logo) logoEl.src = logo;

        /* =========================
           TITLE + TAB
        ========================= */
        document.title = `${companyName} - eCommerce`;

        const titleEl = document.getElementById("pageTitle");
        if (titleEl) titleEl.innerText = `${companyName} - eCommerce`;

        /* =========================
           FAVICON
        ========================= */
        let favicon = document.getElementById("appFavicon");

        if (!favicon) {
            favicon = document.createElement("link");
            favicon.id = "appFavicon";
            favicon.rel = "icon";
            document.head.appendChild(favicon);
        }

        if (logo) favicon.href = logo;

        /* =========================
           MODERN FOOTER DESIGN (AUTO BUILD)
        ========================= */
        const footer = document.getElementById("appFooter");

        if (footer) {
            footer.innerHTML = `
                <div class="footer-container">

                    <!-- LEFT -->
                    <div class="footer-left">
                        <div class="footer-logo">
                            <img src="${logo}" alt="logo">
                        </div>
                        <div>
                            <div class="footer-company">${companyName}</div>
                            <div class="footer-tagline">
                                Smart eCommerce Management System
                            </div>
                        </div>
                    </div>

                    <!-- CENTER -->
                    <div class="footer-center">
                        <a href="#">Dashboard</a>
                        <a href="products.html">Products</a>
                        <a href="#">Orders</a>
                        <a href="#">Reports</a>
                    </div>

                    <!-- RIGHT -->
                    <div class="footer-right">
                        <div>
                            © ${new Date().getFullYear()} ${copyrightCompany}
                        </div>
                        <div>
                            Developed by <strong>${developedBy}</strong>
                        </div>
                    </div>

                </div>
            `;
        }

    } catch (err) {
        console.error("❌ Company load failed:", err);

        document.title = "E-Commerce App";

        const nameEl = document.getElementById("companyName");
        if (nameEl) nameEl.innerText = "E-Shop";

        const footer = document.getElementById("appFooter");
        if (footer) {
            footer.innerHTML = `
                <div style="text-align:center; padding:10px; color:#aaa;">
                    ⚠ Unable to load company info
                </div>
            `;
        }
    }
}

// =========================
// LOGOUT
// =========================
function logout() {

    const now = new Date().toISOString();
    localStorage.setItem("lastLogin", now);

    localStorage.clear();

    window.location.href = "../admin-login.html";
}
