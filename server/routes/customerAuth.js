const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');

const { poolPromise } = require('../config/db');
const sql = require('mssql');

const logAudit = require('../utils/auditLogger');
const getCurrentUser = require('../utils/getCurrentUser');

/* =================================================
   AUDIT USER RESOLVER (CUSTOMER SUPPORT)
================================================= */
function resolveAuditUser(req, fallback = {}) {

    const user = getCurrentUser(req);

    return {
        userId: user.userId || fallback.userId || null,
        userName: user.userName || fallback.userName || "Guest",
        userType: user.userType || fallback.userType || "Customer"
    };
}

/* =================================================
   REGISTER
================================================= */
router.post('/register', async (req, res) => {

    try {

        const { name, email, password } = req.body;

        const pool = await poolPromise;

        const existing = await pool.request()
            .input("Email", email)
            .query(`
                SELECT CustomerID
                FROM Customers
                WHERE Email=@Email
            `);

        if (existing.recordset.length) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "CustomerAuth",
                actionType: "CUSTOMER_REGISTER_FAILED",

                description: `Email already exists: ${email}`,

                status: "FAILED"
            });

            return res.status(400).json({
                message: "Email already registered"
            });
        }

        const hash = await bcrypt.hash(password, 10);

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

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "CUSTOMER_REGISTER",

            description: `Customer registered: ${email}`,

            newValues: { name, email },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Customer registered successfully"
        });

    } catch (err) {

        console.error("REGISTER ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "CUSTOMER_REGISTER_ERROR",

            description: err.message,

            status: "ERROR"
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   FORGOT PASSWORD (FIXED + AUDIT ADDED)
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

        // AUDIT (always log request attempt)
        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "FORGOT_PASSWORD_REQUEST",

            description: `Forgot password requested for ${email}`,

            newValues: { email },

            status: "SUCCESS"
        });

        // SECURITY: don't reveal existence
        if (!result.recordset.length) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "CustomerAuth",
                actionType: "FORGOT_PASSWORD_UNKNOWN_EMAIL",

                description: `Forgot password for non-existing email: ${email}`,

                newValues: { email },

                status: "FAILED"
            });

            return res.json({
                success: true,
                message: "If account exists, reset email sent"
            });
        }

        return res.json({
            success: true,
            message: "Password reset email sent"
        });

    } catch (err) {

        console.error("FORGOT PASSWORD ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "FORGOT_PASSWORD_ERROR",

            description: err.message,

            status: "ERROR"
        });

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

        if (!result.recordset.length) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "CustomerAuth",
                actionType: "CUSTOMER_LOGIN_FAILED",

                description: `Invalid login attempt: ${email}`,

                status: "FAILED"
            });

            return res.status(401).json({
                success: false,
                message: "Invalid login"
            });
        }

        const customer = result.recordset[0];

        if (!customer.PasswordHash) {

            return res.status(400).json({
                success: false,
                message: "Use Google login"
            });
        }

        const ok = await bcrypt.compare(password, customer.PasswordHash);

        if (!ok) {

            await logAudit({
                req,
                userId: customer.CustomerID,
                userName: customer.FullName,

                module: "CustomerAuth",
                actionType: "CUSTOMER_LOGIN_FAILED",

                description: `Wrong password for ${email}`,

                status: "FAILED"
            });

            return res.status(401).json({
                success: false,
                message: "Invalid login"
            });
        }

        const token = jwt.sign(
            {
                customerId: customer.CustomerID,
                email: customer.Email,
                name: customer.FullName
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        await logAudit({
            req,
            userId: customer.CustomerID,
            userName: customer.FullName,

            module: "CustomerAuth",
            actionType: "CUSTOMER_LOGIN",

            description: `${customer.FullName} logged in`,

            status: "SUCCESS"
        });

        res.json({
            success: true,
            token,
            customer
        });

    } catch (err) {

        console.error("LOGIN ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "CUSTOMER_LOGIN_ERROR",

            description: err.message,

            status: "ERROR"
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   GOOGLE LOGIN (FIXED + AUDIT ADDED)
================================================= */
router.get(
    '/google',
    async (req, res, next) => {

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "GOOGLE_LOGIN_INIT",

            description: "Google login initiated",

            status: "SUCCESS"
        });

        return passport.authenticate('google', {
            scope: ['profile', 'email'],
            session: false
        })(req, res, next);
    }
);

/* =================================================
   GOOGLE CALLBACK
================================================= */
router.get('/google/callback',

    passport.authenticate('google', {
        failureRedirect: '/',
        session: false
    }),

    async (req, res) => {

        try {

            const token = jwt.sign(
                {
                    customerId: req.user.CustomerID,
                    email: req.user.Email,
                    name: req.user.FullName
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            await logAudit({
                req,
                userId: req.user.CustomerID,
                userName: req.user.FullName,

                module: "CustomerAuth",
                actionType: "CUSTOMER_GOOGLE_LOGIN",

                description: "Google login success",

                status: "SUCCESS"
            });

            res.redirect(
                `${process.env.CLIENT_URL}/index.html?token=${token}`
            );

        } catch (err) {

            console.error("GOOGLE ERROR:", err);

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "CustomerAuth",
                actionType: "CUSTOMER_GOOGLE_LOGIN_FAILED",

                description: err.message,

                status: "ERROR"
            });

            res.redirect(
                `${process.env.CLIENT_URL}/index.html?googleLogin=failed`
            );
        }
    }
);

/* =================================================
   GET ME
================================================= */
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
                SELECT *
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        await logAudit({
            req,
            userId: decoded.customerId,
            userName: decoded.email,

            module: "CustomerAuth",
            actionType: "CUSTOMER_PROFILE_VIEW",

            description: "Viewed profile",

            status: "SUCCESS"
        });

        res.json(result.recordset[0]);

    } catch (err) {

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
        const token = auth.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const customerId = decoded.customerId;

        const pool = await poolPromise;

        await pool.request()
            .input("CustomerID", sql.Int, customerId)
            .input("FullName", sql.NVarChar, req.body.FullName)
            .input("Email", sql.NVarChar, req.body.Email)
            .input("Phone", sql.NVarChar, req.body.Phone)
            .query(`
                UPDATE Customers
                SET FullName=@FullName,
                    Email=@Email,
                    Phone=@Phone
                WHERE CustomerID=@CustomerID
            `);

        await logAudit({
            req,
            userId: customerId,
            userName: req.body.FullName,

            module: "CustomerAuth",
            actionType: "CUSTOMER_UPDATED",

            description: "Customer profile updated",

            newValues: req.body,

            status: "SUCCESS"
        });

        res.json({ success: true });

    } catch (err) {

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "CustomerAuth",
            actionType: "CUSTOMER_UPDATE_FAILED",

            description: err.message,

            status: "ERROR"
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   VALIDATE COUPON (NO CHANGE)
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