const Customers = {

    DATA: [],

    async init() {
        await this.load();

        document.getElementById("searchBox")
            ?.addEventListener("input", () => this.render());
    },

    // =========================
    // LOAD
    // =========================
    async load() {
        try {
            this.DATA = await App.api("/customers") || [];
            this.render();
        } catch (err) {
            App.toast("Failed to load customers", "error");
        }
    },

    // =========================
    // RENDER
    // =========================
    render() {

        const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
        const tbody = document.getElementById("customerTable");

        if (!tbody) return;

        tbody.innerHTML = "";

        let data = this.DATA;

        if (search) {
            data = data.filter(c =>
                (c.FullName || "").toLowerCase().includes(search) ||
                (c.Email || "").toLowerCase().includes(search) ||
                (c.Phone || "").toLowerCase().includes(search)
            );
        }

        if (!data.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:20px;">
                        No Customers Found
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(c => {

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><div class="ord-name">${c.FullName}</div></td>
                <td>${c.Email || "-"}</td>
                <td>${c.Phone || "-"}</td>
                <td>${c.City || "-"}</td>
                <td>${c.Country || "-"}</td>
                <td>${this.formatDate(c.CreatedAt)}</td>

                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btnx-icon btnx-glass"
                            onclick="Customers.edit(${c.CustomerID})">
                            <i class="fa fa-pen"></i>
                        </button>

                        <button class="btnx-icon btnx-danger"
                            onclick="Customers.delete(${c.CustomerID})">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    },

    // =========================
    // MODAL
    // =========================
    openModal() {
        this.clearForm();
        document.getElementById("modalTitle").innerText = "Add Customer";
        document.getElementById("custModal").classList.add("show");
    },

    closeModal() {
        document.getElementById("custModal").classList.remove("show");
    },

    // =========================
    // EDIT (FIXED)
    // =========================
    edit(id) {

    const c = this.DATA.find(x => x.CustomerID == id);

    if (!c) {
        App.toast("Customer not found", "error");
        return;
    }

    // 1. OPEN MODAL FIRST
    this.openModal();

    // 2. set title
    document.getElementById("modalTitle").innerText = "Edit Customer";

    // 3. wait for DOM paint (VERY IMPORTANT FIX)
    setTimeout(() => {

        document.getElementById("customerId").value = c.CustomerID || "";
        document.getElementById("fullName").value = c.FullName || "";
        document.getElementById("email").value = c.Email || "";
        document.getElementById("phone").value = c.Phone || "";
        document.getElementById("city").value = c.City || "";
        document.getElementById("state").value = c.State || "";
        document.getElementById("country").value = c.Country || "";
        document.getElementById("postalCode").value = c.PostalCode || "";
        document.getElementById("address1").value = c.AddressLine1 || "";
        document.getElementById("address2").value = c.AddressLine2 || "";

    }, 50);
},

    // =========================
    // VALIDATION (NEW)
    // =========================
    validate(payload) {

        if (!payload.fullName) return "Full Name is required";
        if (!payload.email) return "Email is required";
        if (!payload.phone) return "Phone is required";
        if (!payload.city) return "City is required";
        if (!payload.state) return "State is required";
        if (!payload.country) return "Country is required";
        if (!payload.postalCode) return "Postal Code is required";
        if (!payload.addressLine1) return "Address Line 1 is required";

        return null;
    },

    // =========================
    // SAVE (FIXED + TOAST)
    // =========================
    async save() {

        const payload = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            city: document.getElementById("city").value.trim(),
            state: document.getElementById("state").value.trim(),
            country: document.getElementById("country").value.trim(),
            postalCode: document.getElementById("postalCode").value.trim(),
            addressLine1: document.getElementById("address1").value.trim(),
            addressLine2: document.getElementById("address2").value.trim()
        };

        const error = this.validate(payload);

        if (error) {
            App.toast(error, "error");
            return;
        }

        const id = document.getElementById("customerId").value;

        try {

            if (id) {
                await App.api(`/customers/${id}`, "PUT", payload);
                App.toast("Customer updated successfully", "success");
            } else {
                await App.api("/customers", "POST", payload);
                App.toast("Customer added successfully", "success");
            }

            this.closeModal();
            this.load();

        } catch (err) {
            App.toast(err.message || "Save failed", "error");
        }
    },

    // =========================
    // DELETE (TOAST FIXED)
    // =========================
    async delete(id) {

        if (!confirm("Delete customer?")) return;

        try {
            await App.api(`/customers/${id}`, "DELETE");
            App.toast("Customer deleted", "success");
            this.load();
        } catch (err) {
            App.toast("Delete failed", "error");
        }
    },

    // =========================
    // CLEAR
    // =========================
    clearForm() {

        [
            "customerId","fullName","email","phone",
            "city","state","country","postalCode",
            "address1","address2"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
    },

    formatDate(date) {
        if (!date) return "-";
        return new Date(date).toLocaleDateString();
    }
};