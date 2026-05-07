// =========================
// PRODUCTS MODULE (FINAL FIXED + CLEAN)
// =========================

const Products = {

    PRODUCTS: [],
    CATEGORIES: [],

    // =========================
    // INIT
    // =========================
    init() {
        this.loadCategories();        
        this.loadUser();

        this.waitForAppReady();
    },

    async waitForAppReady() {
    await App.READY_PROMISE;   // 🔥 clean & safe
    this.loadProducts();
},

    // =========================
    // USER
    // =========================
    async loadUser() {
        try {
            const data = await App.api("/profile");

            document.getElementById("userName").innerText = data.Name || "Admin";
            document.getElementById("userRole").innerText =
                localStorage.getItem("role") || "User";

            if (data.Photo) {
                document.getElementById("userPhoto").src = data.Photo;
            }

            const lastLogin = document.getElementById("lastLogin");
            if (lastLogin) {
                lastLogin.innerText = data.LastLogin
                    ? "Last login: " + App.formatDate(data.LastLogin)
                    : "Last login: First login";
            }

        } catch (err) {
            console.error("User load error:", err);
        }
    },

    // =========================
    // LOAD PRODUCTS
    // =========================
    async loadProducts() {
        try {
            const data = await App.api("/products");
            this.PRODUCTS = data;
            this.applyFilters();
        } catch (err) {
            App.toast("Failed to load products", "error");
        }
    },

    // =========================
    // LOAD CATEGORIES
    // =========================
    async loadCategories() {
        try {
            const data = await App.api("/categories");

            this.CATEGORIES = data;

            const select = document.getElementById("category");
            const filter = document.getElementById("filterCategory");

            if (select) select.innerHTML = `<option value="">Select Category</option>`;
            if (filter) filter.innerHTML = `<option value="">All Categories</option>`;

            data.forEach(c => {
                if (select)
                    select.innerHTML += `<option value="${c.CategoryID}">${c.Name}</option>`;
                if (filter)
                    filter.innerHTML += `<option value="${c.CategoryID}">${c.Name}</option>`;
            });

            this.renderCategoryModal();

        } catch (err) {
            App.toast("Category load failed", "error");
        }
    },

    // =========================
    // FILTER
    // =========================
    applyFilters() {

        const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
        const catId = document.getElementById("filterCategory")?.value || "";

        let filtered = this.PRODUCTS.filter(p =>
            (p.Name || "").toLowerCase().includes(search)
        );

        if (catId) {
            filtered = filtered.filter(p => p.CategoryID == catId);
        }

        this.renderProducts(filtered);
    },

    renderProducts(data) {

    const symbol = App.CURRENCY_SYMBOL || "$";

    const grid = document.getElementById("productGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (!data.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-box-open"></i>
                <h3>No Products Found</h3>
            </div>
        `;
        return;
    }

    const now = new Date();

    const grouped = {};

    data.forEach(p => {
        const cat = p.Category || "Uncategorized";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    Object.keys(grouped).forEach(cat => {

        const block = document.createElement("div");
        block.className = "category-block";

        const title = document.createElement("div");
        title.className = "cat-title";
        title.innerText = "📁 " + cat;

        const productsDiv = document.createElement("div");
        productsDiv.className = "category-products";

        grouped[cat].forEach(p => {

            let finalPrice = parseFloat(p.Price);

            // =========================
            // OFFER VALIDATION (AUTO EXPIRE)
            // =========================
            let offerActive = false;

            if (p.HasOffer) {

                const start = p.OfferStart ? new Date(p.OfferStart) : null;
                const end = p.OfferEnd ? new Date(p.OfferEnd) : null;

                offerActive =
                    (!start || start <= now) &&
                    (!end || end >= now);

                // if expired → treat as no offer
                if (!offerActive) {
                    p.HasOffer = 0;
                }
            }

            // =========================
            // PRICE CALCULATION
            // =========================
            if (offerActive && p.HasOffer) {

                if (p.OfferType === "PERCENT") {
                    finalPrice -= (finalPrice * parseFloat(p.OfferValue || 0) / 100);
                }

                if (p.OfferType === "AMOUNT") {
                    finalPrice -= parseFloat(p.OfferValue || 0);
                }

                if (finalPrice < 0) finalPrice = 0;
            }

            const card = document.createElement("div");
            card.className = "product-card";

            card.innerHTML = `

                <div class="product-actions">
                    <button class="icon-btn edit" onclick="Products.edit(${p.ProductID})">
                        <i class="fa fa-pen"></i>
                    </button>

                    <button class="icon-btn delete" onclick="Products.delete(${p.ProductID})">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>

                ${offerActive && p.HasOffer ? `
                    <div class="offer-badge">
                        <i class="fa fa-tags"></i>
                        ${p.OfferType === 'PERCENT'
                            ? p.OfferValue + '% OFF'
                            : symbol + p.OfferValue + ' OFF'}
                    </div>
                ` : ""}

                <img src="${p.Image || '../assets/no-image.png'}" class="product-img"/>

                <h3>${p.Name}</h3>

                ${offerActive && p.HasOffer ? `
                    <div class="price-box">

                        <div class="old-price">
                            ${symbol}${parseFloat(p.Price).toFixed(2)}
                        </div>

                        <div class="offer-price">
                            ${symbol}${finalPrice.toFixed(2)} / ${p.UnitType || ""}
                        </div>

                    </div>

                    <div class="offer-dates">
                        <small>
                            ${p.OfferStart ? new Date(p.OfferStart).toLocaleDateString() : ""}
                            → 
                            ${p.OfferEnd ? new Date(p.OfferEnd).toLocaleDateString() : ""}
                        </small>
                    </div>

                ` : `
                    <p class="normal-price">
                        ${symbol}${parseFloat(p.Price).toFixed(2)}
                        / ${p.UnitType || ""}
                    </p>
                `}

                <small>Stock: ${p.Stock}</small>

                <div class="status ${p.IsActive ? 'active' : 'inactive'}">
                    ${p.IsActive ? 'Active' : 'Inactive'}
                </div>

                <button class="toggle-btn ${p.IsActive ? 'deactivate-btn' : 'activate-btn'}"
                    onclick="Products.toggleStatus(${p.ProductID}, ${p.IsActive})">

                    <i class="fa ${p.IsActive ? 'fa-ban' : 'fa-check-circle'}"></i>
                    ${p.IsActive ? 'Deactivate Product' : 'Activate Product'}

                </button>
            `;

            productsDiv.appendChild(card);
        });

        block.appendChild(title);
        block.appendChild(productsDiv);
        grid.appendChild(block);
    });
},

/* =========================
   EDIT
========================= */
edit(id) {

    const p = this.PRODUCTS.find(x => x.ProductID == id);
    if (!p) return;

    document.getElementById("name").value = p.Name;
    document.getElementById("name").dataset.id = p.ProductID;

    document.getElementById("category").value = p.CategoryID;
    document.getElementById("unitType").value = p.UnitType || "";
    document.getElementById("price").value = p.Price;
    document.getElementById("stock").value = p.Stock;
    document.getElementById("barcode").value = p.Barcode || "";
    document.getElementById("description").value = p.Description || "";
    document.getElementById("isActive").checked = p.IsActive == 1;

    /* OFFER */
    document.getElementById("hasOffer").checked = p.HasOffer == 1;
    document.getElementById("offerType").value = p.OfferType || "";
    document.getElementById("offerValue").value = p.OfferValue || "";

    /* =========================
   SAFE DATE HANDLING
========================= */

const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
};

document.getElementById("offerStart").value = formatDate(p.OfferStart);
document.getElementById("offerEnd").value = formatDate(p.OfferEnd);

    document.getElementById("productModal").classList.add("show");
},

/* =========================
   SAVE
========================= */
async save() {

    const id = document.getElementById("name").dataset.id;

    const name = document.getElementById("name").value.trim();
    const unitType = document.getElementById("unitType").value;
    const price = parseFloat(document.getElementById("price").value);
    const stockValue = document.getElementById("stock").value;
    const stock = parseInt(stockValue);
    const barcode = document.getElementById("barcode").value.trim();
    const category = document.getElementById("category").value;
    const file = document.getElementById("image").files[0];

    /* BASIC VALIDATION */
    if (!name) return App.toast("Product name required", "warning");
    if (!unitType) return App.toast("Select unit type", "warning");
    if (!price || price <= 0) return App.toast("Enter valid price", "warning");
    if (!stockValue || isNaN(stock)) return App.toast("Stock is required", "warning");
    if (stock < 0) return App.toast("Stock cannot be negative", "warning");
    if (!category) return App.toast("Select category", "warning");
    if (!barcode) return App.toast("Barcode is required", "warning");
    if (!id && !file) return App.toast("Product image is required", "warning");

    const hasOffer = document.getElementById("hasOffer").checked;
const offerType = document.getElementById("offerType").value;
const offerValue = document.getElementById("offerValue").value;
const offerStart = document.getElementById("offerStart").value;
const offerEnd = document.getElementById("offerEnd").value;

if (hasOffer) {

    if (!offerType)
        return App.toast("Select offer type", "warning");

    if (!offerValue || parseFloat(offerValue) <= 0)
        return App.toast("Enter valid offer value", "warning");

    if (!offerStart)
        return App.toast("Offer start date required", "warning");

    if (!offerEnd)
        return App.toast("Offer end date required", "warning");

    if (new Date(offerStart) > new Date(offerEnd))
        return App.toast("Offer end date must be after start date", "warning");
}

    /* IMAGE */
    let imageBase64 = null;
    let mimeType = null;

    if (file) {
        imageBase64 = await new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result.split(",")[1]);
            r.readAsDataURL(file);
        });
        mimeType = file.type;
    }

    /* PAYLOAD */
    const payload = {
        name,
        description: document.getElementById("description").value,
        category,
        price,
        stock,
        barcode,
        unitType,

        isActive: document.getElementById("isActive").checked ? 1 : 0,

        hasOffer: hasOffer ? 1 : 0,
        offerType: offerType || null,
        offerValue: parseFloat(offerValue || 0),
        offerStart: offerStart || null,
        offerEnd: offerEnd || null,

        imageBase64,
        mimeType
    };

    try {

        if (id) {
            await App.api(`/products/${id}`, "PUT", payload);
            App.toast("Product updated", "success");
        } else {
            await App.api("/products", "POST", payload);
            App.toast("Product added", "success");
        }

        this.closeModal();
        this.loadProducts();

    } catch (err) {
        App.toast(err.message || "Save failed", "error");
    }
},

    // =========================
    // DELETE
    // =========================
    async delete(id) {
        if (!confirm("Delete product?")) return;

        await App.api(`/products/${id}`, "DELETE");
        this.loadProducts();
    },

    // =========================
    // TOGGLE STATUS
    // =========================
    async toggleStatus(id, current) {

        await App.api(`/products/${id}`, "PUT", {
            isActive: current ? 0 : 1
        });

        this.loadProducts();
    },

    // =========================
    // MODAL
    // =========================
    openModal() {

        document.getElementById("name").value = "";
        document.getElementById("name").dataset.id = "";

        document.getElementById("category").value = "";
        document.getElementById("unitType").value = "";
        document.getElementById("price").value = "";
        document.getElementById("stock").value = "";
        document.getElementById("barcode").value = "";
        document.getElementById("description").value = "";
        document.getElementById("isActive").checked = true;
        document.getElementById("image").value = "";

        document.getElementById("productModal").classList.add("show");
    },

    closeModal() {
        document.getElementById("productModal").classList.remove("show");
    },

    // =========================
    // CATEGORY MODAL (FIXED FULL)
    // =========================
    openCategoryModal() {
        document.getElementById("categoryModal")?.classList.add("show");
        this.renderCategoryModal();
    },

    closeCategoryModal() {
        document.getElementById("categoryModal")?.classList.remove("show");
    },

    renderCategoryModal() {

        const grid = document.getElementById("categoryGrid");
        if (!grid) return;

        grid.innerHTML = "";

        this.CATEGORIES.forEach(c => {

            const div = document.createElement("div");
            div.className = "category-item";

            div.innerHTML = `
                <span>${c.Name}</span>
                <button onclick="Products.deleteCategory(${c.CategoryID})">
                    <i class="fa fa-trash"></i>
                </button>
            `;

            grid.appendChild(div);
        });
    },

    filterCategories() {

        const val = document.getElementById("categorySearch")?.value.toLowerCase() || "";

        document.querySelectorAll(".category-item").forEach(i => {
            const text = i.innerText.toLowerCase();
            i.style.display = text.includes(val) ? "flex" : "none";
        });
    },

    async addCategory() {

        const input = document.getElementById("newCategory");
        const name = input.value.trim();

        if (!name) return App.toast("Enter category name", "warning");

        await App.api("/categories", "POST", { name });

        App.toast("Category added", "success");
        input.value = "";

        this.loadCategories();
    },

    async deleteCategory(id) {

        if (!confirm("Delete category?")) return;

        await App.api(`/categories/${id}`, "DELETE");

        App.toast("Category deleted", "success");
        this.loadCategories();
    }
};


// =========================
// GLOBAL HOOKS (FIXED - NO MISSING FUNCTIONS)
// =========================
function applyFilters() { Products.applyFilters(); }
function openProductModal() { Products.openModal(); }
function closeModal() { Products.closeModal(); }
function saveProduct() { Products.save(); }

function openCategoryModal() { Products.openCategoryModal(); }
function closeCategoryModal() { Products.closeCategoryModal(); }
function filterCategories() { Products.filterCategories(); }
function addCategory() { Products.addCategory(); }

function logout() { App.logout(); }