const jwt = require("jsonwebtoken");

function getCurrentUser(req) {

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            return {
                userId: null,
                userName: "Guest",
                userType: "Guest"
            };
        }

        const token = auth.split(" ")[1];

        if (!token) {

            return {
                userId: null,
                userName: "Guest",
                userType: "Guest"
            };
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // =========================
        // CUSTOMER TOKEN
        // =========================
        if (decoded.customerId) {

            return {
                userId: decoded.customerId,
                userName:
                    decoded.name ||
                    decoded.email ||
                    "Customer",

                userType: "Customer"
            };
        }

        // =========================
        // ADMIN / USER TOKEN
        // =========================
        if (decoded.userId) {

            return {
                userId: decoded.userId,

                userName:
                    decoded.email ||
                    decoded.name ||
                    "User",

                userType:
                    decoded.role || "User"
            };
        }

        return {
            userId: null,
            userName: "Unknown",
            userType: "Unknown"
        };

    } catch {

        return {
            userId: null,
            userName: "Guest",
            userType: "Guest"
        };
    }
}

module.exports = getCurrentUser;