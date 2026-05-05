// =========================
// PROFILE MODULE
// =========================

const Profile = {

    init() {
        this.loadUser();
        this.loadProfile();
    },

    // ================= LOAD HEADER USER =================
    async loadUser() {

        try {

            const data = await App.api("/profile");

            document.getElementById("pNameTop").innerText =
                data.Name || "User";

            const role = localStorage.getItem("role") || "Admin";
            document.getElementById("pRoleTop").innerText = role;
            document.getElementById("pRoleBox").innerText = role;

            if (data.Photo) {
                document.getElementById("pPhotoTop").src = data.Photo;
            }

            if (data.LastLogin) {
                document.getElementById("pLastLogin").innerText =
                    "Last login: " + App.formatDate(data.LastLogin);

                document.getElementById("pLastLoginBox").innerText =
                    App.formatDate(data.LastLogin);
            }

        } catch (err) {
            console.error("loadUser error:", err);
        }
    },

    // ================= LOAD FORM =================
    async loadProfile() {

        try {

            const data = await App.api("/profile");

            document.getElementById("pName").value = data.Name || "";
            document.getElementById("pEmail").value = data.Email || "";
            document.getElementById("pUsername").value = data.Username || "";

            if (data.Photo) {
                document.getElementById("pPhoto").src = data.Photo;
            }

        } catch (err) {
            console.error("loadProfile error:", err);
        }
    },

    // ================= SAVE PROFILE =================
    async save(e) {

        const btn = e.target;
        btn.disabled = true;
        btn.innerHTML = "Saving...";

        try {

            const file = document.getElementById("pPhotoInput").files[0];

            let photoBase64 = null;
            let mimeType = null;

            if (file) {
                photoBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(",")[1]);
                    reader.readAsDataURL(file);
                });

                mimeType = file.type;
            }

            await App.api("/profile", "POST", {
                name: document.getElementById("pName").value,
                email: document.getElementById("pEmail").value,
                username: document.getElementById("pUsername").value,
                photoBase64,
                mimeType
            });

            alert("Profile updated successfully");

            this.loadUser();
            this.loadProfile();

        } catch (err) {
            alert(err.message);
        }

        btn.disabled = false;
        btn.innerHTML = "Save";
    },

    // ================= PHOTO PREVIEW =================
    preview(event) {

        const file = event.target.files[0];

        if (file) {
            document.getElementById("pPhoto").src =
                URL.createObjectURL(file);
        }
    }
};