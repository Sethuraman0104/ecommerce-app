const Settings = {

    DATA: [],
    selectedCurrency: "",

    async init() {
        await this.load();
        await this.loadCurrencies();
    },

    async load() {

        const res = await App.api("/settings");
        this.DATA = res;

        this.bind();
    },

    bind() {

        document.getElementById("developedBy").value =
            this.get("DevelopedBy");

        document.getElementById("copyrightName").value =
            this.get("CopyrightsCompanyName");

        document.getElementById("vatPercent").value =
            this.get("VATPercent") || 0;

        document.getElementById("additionalCharges").value =
            this.get("AdditionalChargesPercent") || 0;

        this.selectedCurrency = this.get("Currency");

        // ✅ PAYMENT METHODS
        const methods = (this.get("AllowedPaymentMethods") || "").split(",");

        document.querySelectorAll(".payMethod").forEach(cb => {
            cb.checked = methods.includes(cb.value);
        });
    },

    get(key) {
        return this.DATA.find(x => x.KeyName === key)?.Value || "";
    },

    async loadCurrencies() {

        try {
            const data = await App.api("/settings/currencies");

            const ddl = document.getElementById("currency");
            ddl.innerHTML = "";

            data.forEach(c => {
                ddl.innerHTML += `
                    <option value="${c.Code}">
                        ${c.Code} - ${c.Name}
                    </option>
                `;
            });

            if (this.selectedCurrency) {
                ddl.value = this.selectedCurrency;
            }

        } catch {
            App.toast("Currency load failed", "error");
        }
    },

    async save() {

        // ✅ GET SELECTED PAYMENT METHODS
        const methods = [...document.querySelectorAll(".payMethod:checked")]
            .map(x => x.value)
            .join(",");

        const payload = [

            {
                keyName: "Currency",
                value: document.getElementById("currency").value
            },
            {
                keyName: "VATPercent",
                value: document.getElementById("vatPercent").value || "0"
            },
            {
                keyName: "AdditionalChargesPercent",
                value: document.getElementById("additionalCharges").value || "0"
            },
            {
                keyName: "AllowedPaymentMethods",
                value: methods
            },
            {
                keyName: "DevelopedBy",
                value: document.getElementById("developedBy").value
            },
            {
                keyName: "CopyrightsCompanyName",
                value: document.getElementById("copyrightName").value
            }

        ];

        await App.api("/settings", "PUT", payload);

        App.toast("Settings saved successfully", "success");
    }
};