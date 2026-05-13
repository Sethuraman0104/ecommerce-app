const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');

const { poolPromise } = require('../config/db');
const sql = require('mssql');

/* =================================================
   REGISTER
================================================= */
router.post('/register', async (req, res) => {

    try {

        const { name, email, password } = req.body;

        const pool = await poolPromise;

        // CHECK EXISTING EMAIL
        const existing = await pool.request()
            .input("Email", email)
            .query(`
                SELECT CustomerID
                FROM Customers
                WHERE Email=@Email
            `);

        if (existing.recordset.length) {

            return res.status(400).json({
                message: "Email already registered"
            });
        }

        // HASH PASSWORD
        const hash = await bcrypt.hash(password, 10);

        // INSERT CUSTOMER
        await pool.request()
            .input("FullName", name)
            .input("Email", email)
            .input("PasswordHash", hash)
            .query(`
                INSERT INTO Customers
                (
                    FullName,
                    Email,
                    PasswordHash,
                    CreatedAt
                )
                VALUES
                (
                    @FullName,
                    @Email,
                    @PasswordHash,
                    GETDATE()
                )
            `);

        res.json({
            success: true,
            message: "Customer registered successfully"
        });

    } catch (err) {

        console.error("REGISTER ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   FORGOT PASSWORD
================================================= */
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

        // SECURITY:
        // DON'T REVEAL WHETHER ACCOUNT EXISTS
        if (!result.recordset.length) {

            return res.json({
                success: true,
                message: "If account exists, reset email sent"
            });
        }

        // TODO:
        // Generate reset token
        // Send email

        return res.json({
            success: true,
            message: "Password reset email sent"
        });

    } catch (err) {

        console.error("FORGOT PASSWORD ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Unable to process request"
        });
    }
});

/* =================================================
   LOGIN
================================================= */
router.post('/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        const pool = await poolPromise;

        const result = await pool.request()
            .input("Email", email)
            .query(`
                SELECT *
                FROM Customers
                WHERE Email=@Email
            `);

        // USER NOT FOUND
        if (!result.recordset.length) {

            return res.status(401).json({
                success: false,
                message: "Invalid login"
            });
        }

        const customer = result.recordset[0];

        // GOOGLE ACCOUNT ONLY
        if (!customer.PasswordHash) {

            return res.status(400).json({
                success: false,
                message: "Use Google login"
            });
        }

        // CHECK PASSWORD
        const ok = await bcrypt.compare(
            password,
            customer.PasswordHash
        );

        if (!ok) {

            return res.status(401).json({
                success: false,
                message: "Invalid login"
            });
        }

        // CREATE JWT
        const token = jwt.sign(
            {
                customerId: customer.CustomerID,
                email: customer.Email,
                name: customer.FullName
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            success: true,
            token,
            customer
        });

    } catch (err) {

        console.error("LOGIN ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   GOOGLE LOGIN
================================================= */
router.get(
    '/google',

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false
    })
);

/* =================================================
   GOOGLE CALLBACK
================================================= */
router.get(
    '/google/callback',

    passport.authenticate('google', {
        failureRedirect: '/',
        session: false
    }),

    async (req, res) => {

        try {

            // CREATE JWT
            const token = jwt.sign(
                {
                    customerId: req.user.CustomerID,
                    email: req.user.Email,
                    name: req.user.FullName
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );

            // REDIRECT TO FRONTEND
            res.redirect(
                `${process.env.CLIENT_URL}/index.html?token=${token}`
            );

        } catch (err) {

            console.error("GOOGLE CALLBACK ERROR:", err);

            res.redirect(
                `${process.env.CLIENT_URL}/index.html?googleLogin=failed`
            );
        }
    }
);

/* =================================================
   GET CURRENT CUSTOMER
================================================= */
router.get('/me', async (req, res) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            return res.status(401).json({
                message: "No token"
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

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

        res.json(result.recordset[0]);

    } catch (err) {

        console.error("ME ERROR:", err);

        res.status(401).json({
            message: "Invalid token"
        });
    }
});

/* =================================================
   UPDATE CUSTOMER
================================================= */
router.put('/update', async (req, res) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            return res.status(401).json({
                success: false,
                message: "No token"
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

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

        res.json({
            success: true
        });

    } catch (err) {

        console.error("UPDATE ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Update failed",
            error: err.message
        });
    }
});

/* =================================================
   VALIDATE COUPON
================================================= */
router.get('/coupons/validate', async (req, res) => {

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

            return res.json({
                valid: false
            });
        }

        res.json({
            valid: true,
            coupon: result.recordset[0]
        });

    } catch (err) {

        console.error("COUPON VALIDATION ERROR:", err);

        res.status(500).json({
            valid: false
        });
    }
});

module.exports = router;