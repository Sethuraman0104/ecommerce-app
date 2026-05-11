const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { poolPromise } = require('../config/db');
const sql = require('mssql'); // ✅ ADD THIS at top (IMPORTANT)

/* ================= REGISTER ================= */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const pool = await poolPromise;

        const hash = await bcrypt.hash(password, 10);

        await pool.request()
            .input("FullName", name)
            .input("Email", email)
            .input("PasswordHash", hash)
            .query(`
                INSERT INTO Customers (FullName, Email, PasswordHash, CreatedAt)
                VALUES (@FullName, @Email, @PasswordHash, GETDATE())
            `);

        res.json({ message: "Customer registered" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/forgot-password', async (req, res) => {

    try {

        const { email } = req.body;

        const pool = await poolPromise;

        const result = await pool.request()
            .input("Email", email)
            .query(`
                SELECT *
                FROM Customers
                WHERE Email=@Email
            `);

        if (!result.recordset.length) {

            return res.json({
                message:
                    "If account exists, reset email sent"
            });
        }

        // TODO:
        // generate reset token
        // send email

        return res.json({
            message:
                "Password reset email sent"
        });

    } catch {

        res.status(500).json({
            message:
                "Unable to process request"
        });
    }
});

/* ================= LOGIN ================= */
router.post('/login', async (req, res) => {
    try {

        const { email, password } = req.body;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("Email", email)
            .query(`SELECT * FROM Customers WHERE Email=@Email`);

        if (!result.recordset.length)
            return res.status(401).json({ message: "Invalid login" });

        const customer = result.recordset[0];

        if (!customer.PasswordHash)
            return res.status(400).json({ message: "Use Google login" });

        const ok = await bcrypt.compare(password, customer.PasswordHash);

        if (!ok)
            return res.status(401).json({ message: "Invalid login" });

        const token = jwt.sign(
            {
                customerId: customer.CustomerID,
                email: customer.Email,
                name: customer.FullName
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ token, customer });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* ================= GOOGLE LOGIN ================= */
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

/* ================= GOOGLE CALLBACK ================= */
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {

        const token = jwt.sign(
            {
                customerId: req.user.CustomerID,
                email: req.user.Email,
                name: req.user.FullName
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.redirect(`http://localhost:3000/index.html?token=${token}`);
    }
);

router.get('/me', async (req, res) => {
    try {

        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ message: "No token" });

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const pool = await poolPromise;

        const result = await pool.request()
            .input("CustomerID", decoded.customerId)
            .query(`
                SELECT 
                    CustomerID,
                    FullName,
                    Email,
                    Phone,
                    AddressLine1,
                    AddressLine2,
                    City,
                    State,
                    Country,
                    PostalCode
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        return res.json(result.recordset[0]);

    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
});

router.put('/update', async (req, res) => {
    try {

        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ success: false, message: "No token" });

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const customerId = Number(decoded.customerId);

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Invalid CustomerID in token"
            });
        }

        const {
            FullName,
            Email,
            Phone,
            AddressLine1,
            AddressLine2,
            City,
            State,
            Country,
            PostalCode
        } = req.body;

        const pool = await poolPromise;

        await pool.request()
            .input("CustomerID", sql.Int, customerId)
            .input("FullName", sql.NVarChar, FullName || "")
            .input("Email", sql.NVarChar, Email || "")
            .input("Phone", sql.NVarChar, Phone || "")
            .input("AddressLine1", sql.NVarChar, AddressLine1 || "")
            .input("AddressLine2", sql.NVarChar, AddressLine2 || "")
            .input("City", sql.NVarChar, City || "")
            .input("State", sql.NVarChar, State || "")
            .input("Country", sql.NVarChar, Country || "")
            .input("PostalCode", sql.NVarChar, PostalCode || "")
            .query(`
                UPDATE Customers
                SET 
                    FullName=@FullName,
                    Email=@Email,
                    Phone=@Phone,
                    AddressLine1=@AddressLine1,
                    AddressLine2=@AddressLine2,
                    City=@City,
                    State=@State,
                    Country=@Country,
                    PostalCode=@PostalCode
                WHERE CustomerID=@CustomerID
            `);

        res.json({ success: true });

    } catch (err) {
        console.error("UPDATE ERROR:", err);
        res.status(500).json({
            success: false,
            message: "Update failed",
            error: err.message
        });
    }
});

router.get("/coupons/validate", async (req, res) => {

    try {

        const { code } = req.query;

        const pool = await poolPromise;

        const result = await pool.request()
            .input("Code", sql.NVarChar, code)
            .query(`
                SELECT *
                FROM Coupons
                WHERE Code=@Code
                AND IsActive=1
                AND ExpiryDate >= GETDATE()
            `);

        if (!result.recordset.length) {
            return res.json({ valid: false });
        }

        res.json({
            valid: true,
            coupon: result.recordset[0]
        });

    } catch (err) {
        res.status(500).json({ valid: false });
    }
});

module.exports = router;