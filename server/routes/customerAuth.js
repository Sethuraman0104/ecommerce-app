const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { poolPromise } = require('../config/db');

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

        res.redirect(`http://localhost:5000/index.html?token=${token}`);
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
            .query("SELECT * FROM Customers WHERE CustomerID=@CustomerID");

        res.json(result.recordset[0]);

    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
});

module.exports = router;