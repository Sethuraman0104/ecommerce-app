let PRODUCTS = [];
let CATEGORIES = [];
let selectedCategory = null;
let categoryMap = {};

/* ================= INIT ================= */
window.onload = async () => {

    await CustomerApp.READY_PROMISE;

    Shop.cart = JSON.parse(localStorage.getItem("cart")) || [];

    UI.updateBadge();

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

    document.getElementById("categories").innerHTML =

        `<div class="cat active" onclick="filterCat(null, this)">
            All
        </div>`

        +

        CATEGORIES.map(c => `

            <div class="cat" onclick="filterCat(${c.CategoryID}, this)">
                ${c.Name}
            </div>

        `).join("");
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
document.getElementById("search")
    ?.addEventListener("input", renderGrouped);

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
        document.getElementById("search")
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
const UI = {

    updateBadge() {

        const badge = document.querySelector(".badge");

        if (!badge) return;

        badge.innerText = Shop.cart.length || 0;
    },

    openCart() {
        Shop.openCart();
    },

    closeCart() {
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

    const btn = e.currentTarget;

    const circle = document.createElement("span");

    const diameter =
        Math.max(btn.clientWidth, btn.clientHeight);

    const radius = diameter / 2;

    const rect = btn.getBoundingClientRect();

    circle.style.width =
        circle.style.height =
        `${diameter}px`;

    circle.style.left =
        `${e.clientX - rect.left - radius}px`;

    circle.style.top =
        `${e.clientY - rect.top - radius}px`;

    circle.classList.add("ripple");

    const ripple = btn.querySelector(".ripple");

    if (ripple) ripple.remove();

    btn.appendChild(circle);
}