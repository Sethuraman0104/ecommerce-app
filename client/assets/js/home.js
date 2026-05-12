let PRODUCTS = [];
let CATEGORIES = [];
let selectedCategory = null;
let categoryMap = {};

/* ================= INIT ================= */
window.onload = async () => {

    await CustomerApp.READY_PROMISE;

    /* GOOGLE LOGIN TOKEN */

const params =
    new URLSearchParams(window.location.search);

const token = params.get("token");

if (token) {

    localStorage.setItem("token", token);

    history.replaceState(
        {},
        document.title,
        window.location.pathname
    );
}

/* LOAD CUSTOMER */

const savedToken =
    localStorage.getItem("token");

if (savedToken) {

    try {

        const res = await fetch(
            `${CustomerApp.API_BASE}/customer-auth/me`,
            {
                headers: {
                    Authorization:
                        `Bearer ${savedToken}`
                }
            }
        );

        const customer = await res.json();

        localStorage.setItem(
            "customer",
            JSON.stringify(customer)
        );

        Auth.updateUI();

    } catch {

        localStorage.removeItem("token");
    }
}

    Shop.cart = JSON.parse(localStorage.getItem("cart")) || [];

    UI.updateBadge();
    UI.toggleFloatingCart();

    await loadCategories();
    await loadProducts();

    document.addEventListener("click", function (e) {

        if (
            e.target.closest(".card button") ||
            e.target.closest(".btn-primary") ||
            e.target.closest(".checkout")
        ) {
            addRipple(e);
        }
    });
};

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {

    PRODUCTS = await CustomerApp.api("/products") || [];

    console.log("PRODUCTS LOADED:", PRODUCTS);

    renderGrouped();
}

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {

    CATEGORIES = await CustomerApp.api("/categories") || [];

    categoryMap = {};

    CATEGORIES.forEach(c => {
        categoryMap[String(c.CategoryID)] = c.Name;
    });

    /* OLD CATEGORY BAR */

    document.getElementById("categories").innerHTML =

        `
        <div class="cat active"
             onclick="filterCat(null, this)">
            All
        </div>
        `

        +

        CATEGORIES.map(c => `

            <div class="cat"
                 onclick="filterCat(${c.CategoryID}, this)">

                <i class="fa ${
                    CATEGORY_ICONS[c.Name] ||
                    CATEGORY_ICONS["Default"]
                }"></i>

                ${c.Name}

            </div>

        `).join("");

    /* TOP DROPDOWN */

    document.getElementById("dynamicTopCategories").innerHTML =

        CATEGORIES.map(c => `

        <div class="all-cat-item"
             onclick="selectTopCategory(${c.CategoryID}, this)">

            <div class="cat-icon">

                <i class="fa ${
                    CATEGORY_ICONS[c.Name] ||
                    CATEGORY_ICONS["Default"]
                }"></i>

            </div>

            <span>${c.Name}</span>

        </div>

        `).join("");
}

function selectTopCategory(id, el) {

    selectedCategory = id
        ? String(id)
        : null;

    /* ACTIVE */

    document.querySelectorAll(".all-cat-item")
        .forEach(x => x.classList.remove("active"));

    el.classList.add("active");

    renderGrouped();

    /* CLOSE MENU */

    document.getElementById("topCategoryLinks")
        ?.classList.remove("show");

    /* SCROLL */

    document.getElementById("products")
        ?.scrollIntoView({
            behavior: "smooth"
        });
}

function toggleCategoryMenu() {

    document.getElementById("topCategoryLinks")
        ?.classList.toggle("show");
}

/* =========================================
   CLOSE OUTSIDE CLICK
========================================= */

document.addEventListener("click", function(e) {

    if (!e.target.closest(".top-categories")) {

        document.getElementById("topCategoryLinks")
            ?.classList.remove("show");
    }
});

function closeCustomerMenu() {
    document
        .getElementById("customerDropdown")
        ?.classList.remove("show");
}

function closeCategoryMenu() {

    document
        .getElementById("topCategoryLinks")
        ?.classList.remove("show");

}

/* ================= CATEGORY FILTER ================= */
function filterCat(id, el) {

    selectedCategory = id ? String(id) : null;

    document.querySelectorAll(".cat")
        .forEach(x => x.classList.remove("active"));

    el.classList.add("active");

    renderGrouped();
}

/* ================= SEARCH ================= */
let searchScrollTimeout;

document.getElementById("productSearch")
?.addEventListener("input", function () {

    isSearching = this.value.trim().length > 0;

    renderGrouped();

    clearTimeout(searchScrollTimeout);

    searchScrollTimeout = setTimeout(() => {

        if (isSearching) {

            document.getElementById("products")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
        }

    }, 200);
});

/* ================= CATEGORY ICONS ================= */
const CATEGORY_ICONS = {
    "Electronics": "fa-tv",
    "Grocery": "fa-basket-shopping",
    "Fruits": "fa-apple-whole",
    "Vegetables": "fa-carrot",
    "Beverages": "fa-mug-hot",
    "Default": "fa-box"
};

/* ================= RENDER PRODUCTS ================= */
function renderGrouped() {

    let search =
        document.getElementById("productSearch")
            ?.value
            ?.toLowerCase() || "";

    let data = PRODUCTS.filter(p => {

        if (!p.IsActive) {
            return false;
        }

        if (
            selectedCategory &&
            String(p.CategoryID) !== String(selectedCategory)
        ) {
            return false;
        }

        if (
            search &&
            !p.Name.toLowerCase().includes(search)
        ) {
            return false;
        }

        return true;
    });

    /* ================= OFFER PRODUCTS ================= */

    const now = new Date();

    const offerProducts = data.filter(p => {

        if (!p.HasOffer) return false;

        const start =
            p.OfferStart
                ? new Date(p.OfferStart)
                : null;

        const end =
            p.OfferEnd
                ? new Date(p.OfferEnd)
                : null;

        return (
            (!start || start <= now) &&
            (!end || end >= now)
        );
    });

    renderOfferProducts(offerProducts);

    /* ================= GROUP BY CATEGORY ================= */

    let grouped = {};

    data.forEach(p => {

        let key = categoryMap[p.CategoryID] || "Others";

        if (!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push(p);
    });

    let keys = Object.keys(grouped);

    if (keys.length === 0) {

        document.getElementById("products").innerHTML = `

        <div class="empty-category">

            <i class="fa fa-box-open"></i>

            <h3>No Products Found</h3>

            <p>Try another category or search keyword</p>

        </div>
        `;

        return;
    }

    let html = "";

    keys.forEach(cat => {

        html += `

<div class="category-section">

    <div class="section-title">

        <div class="section-left">

            <span class="section-icon">
                <i class="fa fa-layer-group"></i>
            </span>

            <span class="section-text">
                ${cat}
            </span>

        </div>

        <div class="section-line"></div>

    </div>

    <div class="product-row">

        ${grouped[cat].map(p => {

            let finalPrice = parseFloat(p.Price || 0);

            let offerActive = false;

            if (p.HasOffer) {

                const start =
                    p.OfferStart
                        ? new Date(p.OfferStart)
                        : null;

                const end =
                    p.OfferEnd
                        ? new Date(p.OfferEnd)
                        : null;

                offerActive =
                    (!start || start <= now) &&
                    (!end || end >= now);

                if (offerActive) {

                    if (p.OfferType === "PERCENT") {

                        finalPrice -= (
                            finalPrice *
                            parseFloat(p.OfferValue || 0) / 100
                        );
                    }

                    if (p.OfferType === "AMOUNT") {

                        finalPrice -= parseFloat(
                            p.OfferValue || 0
                        );
                    }

                    if (finalPrice < 0) {
                        finalPrice = 0;
                    }
                }
            }

            return `

            <div class="card"
                 onclick="Shop.open(${p.ProductID})">

                ${offerActive ? `

                    <div class="product-offer-badge">

                        <i class="fa fa-fire"></i>

                        ${
                            p.OfferType === "PERCENT"
                                ? `${p.OfferValue}% OFF`
                                : `${CustomerApp.CURRENCY_SYMBOL}${p.OfferValue} OFF`
                        }

                    </div>

                ` : ""}

                <div class="img-wrap">

                    <img src="${p.Image || 'assets/img/no-image.png'}">

                </div>

                <div class="card-body">

                    <h4>${p.Name}</h4>

                    <div class="meta">

                        <span class="unit">
                            ${p.UnitType || 'pcs'}
                        </span>

                    </div>

                    ${offerActive ? `

                        <div class="price-wrap">

                            <div class="old-price">

                                ${CustomerApp.CURRENCY_SYMBOL}
                                ${parseFloat(p.Price).toFixed(2)}

                            </div>

                            <div class="offer-price">

                                ${CustomerApp.CURRENCY_SYMBOL}
                                ${finalPrice.toFixed(2)}

                            </div>

                        </div>

                        <div class="offer-validity">

                            <i class="fa fa-clock"></i>

                            ${
                                p.OfferEnd
                                    ? "Ends " +
                                      new Date(p.OfferEnd).toLocaleDateString()
                                    : ""
                            }

                        </div>

                    ` : `

                        <div class="price">

                            ${CustomerApp.CURRENCY_SYMBOL}
                            ${parseFloat(p.Price).toFixed(2)}

                        </div>

                    `}

                    <button onclick="event.stopPropagation();Shop.open(${p.ProductID})">
<i class="fa fa-cart-plus"></i>
                        Add to Cart

                    </button>

                </div>

            </div>
            `;

        }).join("")}

    </div>

</div>
`;
    });

    document.getElementById("products").innerHTML = html;
}

/* ================= OFFER SECTION ================= */
function renderOfferProducts(products) {

    const container =
        document.getElementById("offerProducts");

    if (!container) return;

    if (!products.length) {

        container.innerHTML = "";
        return;
    }

    container.innerHTML = `

    <div class="offer-header">

        <div class="offer-title">
            <i class="fa fa-bolt"></i>
            Today's Special Offers
        </div>

        <div class="offer-sub">
            Limited time deals available now
        </div>

    </div>

    <div class="offer-slider">

        ${products.map(p => {

            let finalPrice = parseFloat(p.Price || 0);

            if (p.OfferType === "PERCENT") {

                finalPrice -= (
                    finalPrice *
                    parseFloat(p.OfferValue || 0) / 100
                );
            }

            if (p.OfferType === "AMOUNT") {

                finalPrice -= parseFloat(
                    p.OfferValue || 0
                );
            }

            if (finalPrice < 0) {
                finalPrice = 0;
            }

            return `

<div class="offer-card"
     onclick="Shop.open(${p.ProductID})">

    <div class="offer-card-badge">
        ${
            p.OfferType === "PERCENT"
                ? `${p.OfferValue}% OFF`
                : `${CustomerApp.CURRENCY_SYMBOL}${p.OfferValue} OFF`
        }
    </div>

    <!-- ✅ FIXED IMAGE WRAPPER -->
    <div class="offer-img-wrap">
        <img src="${p.Image || 'assets/img/no-image.png'}">
    </div>

    <h3>${p.Name}</h3>

    <div class="offer-prices">

        <span class="offer-old">
            ${CustomerApp.CURRENCY_SYMBOL}
            ${parseFloat(p.Price).toFixed(2)}
        </span>

        <span class="offer-new">
            ${CustomerApp.CURRENCY_SYMBOL}
            ${finalPrice.toFixed(2)}
        </span>

    </div>

    <button>
        <i class="fa fa-cart-plus"></i>
        Add to Cart
    </button>

</div>
`;
        }).join("")}

    </div>
    `;
}

/* ================= SHOP ================= */
const Shop = {

    cart: [],
    current: null,

    /* ================= OPEN QUICK VIEW ================= */
    open(id) {

        let p = PRODUCTS.find(x => x.ProductID == id);

        if (!p) return;

        this.current = p;

        document.getElementById("qImg").src =
            p.Image || "assets/img/no-image.png";

        document.getElementById("qName").innerText =
            p.Name;

        document.getElementById("unitLabel").innerText =
            p.UnitType || "pcs";

        document.getElementById("qty").value = 1;

        this.updateTotal();

        document.getElementById("quickView").style.display =
            "flex";
    },

    /* ================= CHANGE QTY ================= */
    qty(v) {

        let q = document.getElementById("qty");

        let val = parseInt(q.value || 1);

        val = Math.max(1, val + v);

        q.value = val;

        this.updateTotal();
    },

    /* ================= UPDATE TOTAL ================= */
    updateTotal() {

        if (!this.current) return;

        let qty =
            parseInt(
                document.getElementById("qty").value || 1
            );

        let total = qty * this.current.Price;

        document.getElementById("qPrice").innerText =
            CustomerApp.CURRENCY_SYMBOL +
            " " +
            total.toFixed(2);
    },

    /* ================= ADD TO CART ================= */
    add() {

        if (!this.current) return;

        let qty =
            parseInt(
                document.getElementById("qty").value || 1
            );

        let existing =
            this.cart.find(
                x => x.ProductID === this.current.ProductID
            );

        if (existing) {

            existing.Qty += qty;

            existing.Total =
                existing.Qty * existing.Price;

        } else {

            this.cart.push({

                ProductID: this.current.ProductID,
                Name: this.current.Name,
                Price: this.current.Price,
                UnitType: this.current.UnitType,
                Image: this.current.Image,

                Qty: qty,

                Total: qty * this.current.Price
            });
        }

        /* SAVE */
        localStorage.setItem(
            "cart",
            JSON.stringify(this.cart)
        );

        UI.updateBadge();
        UI.toggleFloatingCart();

        this.renderCart();

        this.closeQuick();
    },

    /* ================= CHANGE CART QTY ================= */
    changeQty(index, val) {

        let item = this.cart[index];

        if (!item) return;

        item.Qty = Math.max(1, item.Qty + val);

        item.Total = item.Qty * item.Price;

        localStorage.setItem(
            "cart",
            JSON.stringify(this.cart)
        );

        UI.updateBadge();
        UI.toggleFloatingCart();

        this.renderCart();
    },

    /* ================= REMOVE ================= */
    remove(index) {

        this.cart.splice(index, 1);

        localStorage.setItem(
            "cart",
            JSON.stringify(this.cart)
        );

        UI.updateBadge();
        UI.toggleFloatingCart();

        this.renderCart();
    },

    /* ================= CLOSE QUICK ================= */
    closeQuick() {

        document.getElementById("quickView").style.display =
            "none";
    },

    /* ================= RENDER CART ================= */
    renderCart() {

        let total = 0;

        /* EMPTY CART */
        if (this.cart.length === 0) {

            document.getElementById("cartItems").innerHTML = `

            <div class="empty-cart">

                <i class="fa fa-cart-shopping"></i>

                <h3>Your Cart is Empty</h3>

                <p>
                    Add products to continue shopping
                </p>

            </div>
            `;

            document.getElementById("cartTotal").innerText = "0";

            return;
        }

        document.getElementById("cartItems").innerHTML =

            this.cart.map((c, i) => {

                total += c.Total;

                return `

                <div class="cart-item">

                    <div class="cart-info">

                        <b>${c.Name}</b>

                        <span>
                            ${c.Price} / ${c.UnitType || 'pcs'}
                        </span>

                    </div>

                    <div class="cart-controls">

                        <div class="cart-qty">

                            <button onclick="Shop.changeQty(${i}, -1)">
                                −
                            </button>

                            <span>${c.Qty}</span>

                            <button onclick="Shop.changeQty(${i}, 1)">
                                +
                            </button>

                        </div>

                        <div class="cart-price">

                            ${CustomerApp.CURRENCY_SYMBOL}
                            ${c.Total.toFixed(2)}

                        </div>

                        <button class="remove-btn"
                                onclick="Shop.remove(${i})">

                            <i class="fa fa-trash"></i>

                        </button>

                    </div>

                </div>
                `;
            }).join("");

        document.getElementById("cartTotal").innerText =

            CustomerApp.CURRENCY_SYMBOL +
            " " +
            total.toFixed(2);
    },

    /* ================= OPEN CART ================= */
    openCart() {

        document.getElementById("cartModal").style.display =
            "flex";

        this.renderCart();
    },

    /* ================= CLOSE CART ================= */
    closeCart() {

        document.getElementById("cartModal").style.display =
            "none";
    }
};

/* ================= UI ================= */
/* ================= UI ================= */
const UI = {

    updateBadge: function () {

        const badge = document.querySelector(".badge");

        if (!badge) return;

        badge.innerText = Shop.cart.length || 0;
    },

    toggleFloatingCart: function () {

        const bar =
            document.getElementById("floatingActions");

        const count =
            document.getElementById("floatingCartCount");

        if (!bar || !count) return;

        count.innerText = Shop.cart.length || 0;

        if (Shop.cart.length > 0) {

            bar.classList.add("show");

        } else {

            bar.classList.remove("show");
        }
    },

    openCart: function () {
        Shop.openCart();
    },

    closeCart: function () {
        Shop.closeCart();
    }
};

/* ================= OUTSIDE CLICK CLOSE ================= */
window.onclick = function (e) {

    let quick = document.getElementById("quickView");

    if (e.target === quick) {
        Shop.closeQuick();
    }

    let cart = document.getElementById("cartModal");

    if (e.target === cart) {
        Shop.closeCart();
    }
};

/* ================= RIPPLE EFFECT ================= */
function addRipple(e) {

    const btn =
        e.target.closest("button, .btn-primary, .checkout, .card");

    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const circle = document.createElement("span");

    const diameter =
        Math.max(btn.clientWidth, btn.clientHeight);

    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;

    circle.style.left =
        `${e.clientX - rect.left - radius}px`;

    circle.style.top =
        `${e.clientY - rect.top - radius}px`;

    circle.classList.add("ripple");

    const existing = btn.querySelector(".ripple");
    if (existing) existing.remove();

    btn.appendChild(circle);

    setTimeout(() => circle.remove(), 600);
}

/* ================= AUTH ================= */

const Auth = {

    mode: "login",

    /* ================= OPEN MODAL ================= */

    open() {

    document
        .getElementById("authModal")
        .style.display = "flex";

    document.body.style.overflow = "hidden";

    setTimeout(() => {
    document.getElementById("authEmail").focus();
}, 100);

    // ✅ RESET EVERY TIME MODAL OPENS
    this.resetForm();
},

    /* ================= CLOSE MODAL ================= */

    close() {

        document
            .getElementById("authModal")
            .style.display = "none";

        document.body.style.overflow = "";
    },

    /* ================= TOGGLE LOGIN / REGISTER ================= */

    toggleMode() {

        this.mode =
            this.mode === "login"
                ? "register"
                : "login";

        const isRegister =
            this.mode === "register";

        document.getElementById("authTitle").innerText =
            isRegister
                ? "Create Account"
                : "Customer Login";

        document.getElementById("authName").style.display =
            isRegister
                ? "block"
                : "none";

        document.getElementById("registerBtn").style.display =
            isRegister
                ? "flex"
                : "none";

        document.getElementById("loginBtn").style.display =
            isRegister
                ? "none"
                : "flex";

        document.getElementById("authSwitchText").innerText =
            isRegister
                ? "Already have account?"
                : "New customer?";

        document.getElementById("authSwitchBtn").innerText =
            isRegister
                ? "Login"
                : "Create Account";

        /* CLEAR PASSWORD */

        document.getElementById("authPassword").value = "";
    },

    /* ================= EMAIL VALIDATION ================= */

    isValidEmail(email) {

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        return emailRegex.test(email);
    },

    /* ================= LOGIN ================= */

    async login() {

        try {

            const email =
                document.getElementById("authEmail")
                    .value
                    .trim();

            const password =
                document.getElementById("authPassword")
                    .value
                    .trim();

            /* VALIDATION */

            if (!email) {

                return CustomerApp.toast(
                    "Email address is required",
                    "warning"
                );
            }

            if (!this.isValidEmail(email)) {

                return CustomerApp.toast(
                    "Please enter a valid email address",
                    "warning"
                );
            }

            if (!password) {

                return CustomerApp.toast(
                    "Password is required",
                    "warning"
                );
            }

            /* API */

            const res = await fetch(
                `${CustomerApp.API_BASE}/customer-auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const data = await res.json();

            if (!res.ok) {

                return CustomerApp.toast(
                    data.message || "Login failed",
                    "error"
                );
            }

            /* SAVE */

            localStorage.setItem(
                "token",
                data.token
            );

            localStorage.setItem(
                "customer",
                JSON.stringify(data.customer)
            );

            /* UPDATE UI */

            this.updateUI();

            this.close();

            CustomerApp.toast(
                "Login successful",
                "success"
            );

        } catch (err) {

            console.log(err);

            CustomerApp.toast(
                "Login failed",
                "error"
            );
        }
    },

    /* ================= REGISTER ================= */

    async register() {

        try {

            const name =
                document.getElementById("authName")
                    .value
                    .trim();

            const email =
                document.getElementById("authEmail")
                    .value
                    .trim();

            const password =
                document.getElementById("authPassword")
                    .value
                    .trim();

            /* VALIDATION */

            if (!name) {

                return CustomerApp.toast(
                    "Full name is required",
                    "warning"
                );
            }

            if (name.length < 3) {

                return CustomerApp.toast(
                    "Full name must be at least 3 characters",
                    "warning"
                );
            }

            if (!email) {

                return CustomerApp.toast(
                    "Email address is required",
                    "warning"
                );
            }

            if (!this.isValidEmail(email)) {

                return CustomerApp.toast(
                    "Please enter a valid email address",
                    "warning"
                );
            }

            if (!password) {

                return CustomerApp.toast(
                    "Password is required",
                    "warning"
                );
            }

            if (password.length < 6) {

                return CustomerApp.toast(
                    "Password must be at least 6 characters",
                    "warning"
                );
            }

            /* API */

            const res = await fetch(
                `${CustomerApp.API_BASE}/customer-auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name,
                        email,
                        password
                    })
                }
            );

            const data = await res.json();

            if (!res.ok) {

                return CustomerApp.toast(
                    data.message || "Registration failed",
                    "error"
                );
            }

            CustomerApp.toast(
                "Registration successful",
                "success"
            );

            /* CLEAR */

            document.getElementById("authName").value = "";

            document.getElementById("authEmail").value = "";

            document.getElementById("authPassword").value = "";

            /* SWITCH TO LOGIN */

            this.toggleMode();

        } catch (err) {

            console.log(err);

            CustomerApp.toast(
                "Registration failed",
                "error"
            );
        }
    },

    /* ================= FORGOT PASSWORD ================= */

    async forgotPassword() {

        const email =
            document.getElementById("authEmail")
                .value
                .trim();

        /* VALIDATION */

        if (!email) {

            return CustomerApp.toast(
                "Enter email address first",
                "warning"
            );
        }

        if (!this.isValidEmail(email)) {

            return CustomerApp.toast(
                "Please enter a valid email address",
                "warning"
            );
        }

        try {

            const res = await fetch(
                `${CustomerApp.API_BASE}/customer-auth/forgot-password`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email
                    })
                }
            );

            const data = await res.json();

            if (!res.ok) {

                return CustomerApp.toast(
                    data.message || "Unable to process request",
                    "error"
                );
            }

            CustomerApp.toast(
                data.message ||
                "Reset link sent successfully",
                "success"
            );

        } catch (err) {

            console.log(err);

            CustomerApp.toast(
                "Unable to process request",
                "error"
            );
        }
    },

    /* ================= UPDATE UI ================= */

    updateUI() {

        const customer =
            JSON.parse(
                localStorage.getItem("customer")
            );

        const text =
            document.getElementById("authBtnText");

        const guestMenu =
            document.getElementById("guestMenu");

        const loggedMenu =
            document.getElementById("loggedMenu");

        const avatar =
            document.querySelector(".customer-avatar");

        /* NO LOGIN */

        if (!customer) {

            text.innerText = "Sign In";

            guestMenu.style.display = "block";

            loggedMenu.style.display = "none";

            avatar.innerHTML =
                `<i class="fa fa-user"></i>`;

            return;
        }

        /* USER NAME */

        const customerName =
            customer.FullName ||
            customer.name ||
            "My Account";

        text.innerText = customerName;

        /* AVATAR LETTER */

        avatar.innerHTML =
            `
            <span style="
                font-weight:800;
                font-size:16px;
                color:#fff;
            ">
                ${customerName
                    .charAt(0)
                    .toUpperCase()}
            </span>
            `;

        /* MENUS */

        guestMenu.style.display = "none";

        loggedMenu.style.display = "block";
    },

    /* ================= TOGGLE MENU ================= */

    toggleMenu(e) {

        e.stopPropagation();

        document
            .getElementById("customerDropdown")
            ?.classList.toggle("show");
    },

    /* ================= LOGOUT ================= */

    logout() {

        localStorage.removeItem("token");

        localStorage.removeItem("customer");

        CustomerApp.toast(
            "Logged out successfully",
            "success"
        );

        setTimeout(() => {

            location.reload();

        }, 800);
    },

    /* ================= OPEN REGISTER ================= */

    openRegister() {

        this.open();

        if (this.mode !== "register") {

            this.toggleMode();
        }
    },

    resetForm() {

    document.getElementById("authName").value = "";
    document.getElementById("authEmail").value = "";
    document.getElementById("authPassword").value = "";

    // reset to login mode every time modal opens
    this.mode = "login";

    document.getElementById("authTitle").innerText = "Customer Login";

    document.getElementById("authName").style.display = "none";

    document.getElementById("registerBtn").style.display = "none";

    document.getElementById("loginBtn").style.display = "flex";

    document.getElementById("authSwitchText").innerText = "New customer?";

    document.getElementById("authSwitchBtn").innerText = "Create Account";
}
};

/* ================= CLOSE DROPDOWN ================= */

document.addEventListener("click", function(e){

    if(!e.target.closest(".customer-menu")){

        document
            .getElementById("customerDropdown")
            ?.classList.remove("show");
    }
});

/* ================= CLOSE AUTH MODAL OUTSIDE CLICK ================= */

window.addEventListener("click", function(e){

    const authModal =
        document.getElementById("authModal");

    if(e.target === authModal){

        Auth.close();
    }
});

function clearSearchHistoryFix() {

    const search =
        document.getElementById("productSearch");

    if (!search) return;

    // clear value
    search.value = "";

    // force browser reset
    search.setAttribute(
        "value",
        ""
    );

    // blur/focus trick
    search.blur();

    setTimeout(() => {

        search.focus();

        search.blur();

    }, 10);
}

/* RUN ON LOAD */
window.addEventListener("load", () => {

    clearSearchHistoryFix();
});

/* RUN AFTER CATEGORY FILTER */
document.addEventListener("click", (e) => {

    if (
        e.target.closest(".cat") ||
        e.target.closest(".all-cat-item")
    ) {

        setTimeout(() => {

            clearSearchHistoryFix();

        }, 50);
    }
});