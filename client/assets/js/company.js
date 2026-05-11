const Company = {

    init() {
        this.load();
    },

    async load() {
        try {
            const res = await fetch(`${CONFIG.API_BASE}/company`);
            const data = await res.json();

            document.getElementById("cName").value = data.Name || "";
            document.getElementById("cEmail").value = data.Email || "";
            document.getElementById("cPhone").value = data.Phone || "";
            document.getElementById("cWebsite").value = data.Website || "";
            document.getElementById("cAddress").value = data.Address || "";

            if (data.Logo) {
                document.getElementById("logoPreview").src = data.Logo;
                document.getElementById("companyLogo").src = data.Logo;
            }

            if (data.Name) {
                document.getElementById("companyName").innerText = data.Name;
            }

        } catch (err) {
            console.error("Company load error:", err);
        }
    },

    async save(e) {

        const btn = e.target;
        btn.disabled = true;
        btn.innerHTML = "Saving...";

        try {

            const file = document.getElementById("cLogo").files[0];

            let logoBase64 = null;
            let mimeType = null;

            if (file) {
                logoBase64 = await this.getBase64(file);
                mimeType = file.type;
            }

            const payload = {
                name: document.getElementById("cName").value.trim(),
                email: document.getElementById("cEmail").value.trim(),
                phone: document.getElementById("cPhone").value.trim(),
                website: document.getElementById("cWebsite").value.trim(),
                address: document.getElementById("cAddress").value.trim(),
                logoBase64,
                mimeType
            };

            const res = await fetch(`${CONFIG.API_BASE}/company`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            alert("✅ " + data.message);

            this.load();

        } catch (err) {
            alert("❌ " + err.message);
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Save Company';
    },

    preview(event) {
        const file = event.target.files[0];
        if (file) {
            document.getElementById("logoPreview").src =
                URL.createObjectURL(file);
        }
    },

    getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};