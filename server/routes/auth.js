const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

const { poolPromise } = require('../config/db');
const logAudit = require('../utils/auditLogger');

/* =================================================
   REGISTER USER
================================================= */
router.post('/register', async (req, res) => {

    try {

        const { name, email, password } = req.body;

        const pool = await poolPromise;

        /* =========================
           CHECK EXISTING EMAIL
        ========================= */
        const existing = await pool.request()
            .input('Email', email)
            .query(`
                SELECT UserID
                FROM Users
                WHERE Email=@Email
            `);

        if (existing.recordset.length) {

            await logAudit({
                req,

                module: "Auth",
                actionType: "REGISTER_FAILED",

                description: `Registration failed. Email already exists: ${email}`,

                newValues: {
                    name,
                    email
                },

                status: "FAILED"
            });

            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        /* =========================
           HASH PASSWORD
        ========================= */
        const hashedPassword = await bcrypt.hash(password, 10);

        /* =========================
           INSERT USER
        ========================= */
        const insertResult = await pool.request()
            .input('Name', name)
            .input('Email', email)
            .input('PasswordHash', hashedPassword)
            .input('RoleID', 2)
            .input('IsActive', 1)
            .query(`
                INSERT INTO Users
                (
                    Name,
                    Email,
                    PasswordHash,
                    RoleID,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.UserID
                VALUES
                (
                    @Name,
                    @Email,
                    @PasswordHash,
                    @RoleID,
                    @IsActive,
                    GETDATE()
                )
            `);

        const userId = insertResult.recordset[0].UserID;

        /* =========================
           AUDIT LOG
        ========================= */
        await logAudit({
            req,
            userId,
            userName: name,

            module: "Auth",
            actionType: "REGISTER",

            description: `New user registered: ${email}`,

            newValues: {
                name,
                email,
                role: "User"
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "User registered successfully"
        });

    } catch (err) {

        console.error("REGISTER ERROR:", err);

        await logAudit({
            req,

            module: "Auth",
            actionType: "REGISTER_ERROR",

            description: err.message,

            newValues: {
                email: req.body?.email
            },

            status: "ERROR"
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

/* =================================================
   LOGIN
================================================= */
router.post('/login', async (req, res) => {

    try {

        const pool = await poolPromise;

        const { email, password } = req.body;

        /* =========================
           FIND USER
        ========================= */
        const result = await pool.request()
            .input('Email', email)
            .query(`
                SELECT
                    UserID,
                    Name,
                    Email,
                    PasswordHash,
                    RoleID,
                    IsActive
                FROM Users
                WHERE Email=@Email
                AND IsActive=1
            `);

        /* =========================
           USER NOT FOUND
        ========================= */
        if (!result.recordset.length) {

            await logAudit({
                req,

                module: "Auth",
                actionType: "LOGIN_FAILED",

                description: `Failed login attempt for ${email}`,

                newValues: {
                    email
                },

                status: "FAILED"
            });

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.recordset[0];

        /* =========================
           CHECK PASSWORD
        ========================= */
        const valid = await bcrypt.compare(
            password,
            user.PasswordHash
        );

        if (!valid) {

            await logAudit({
                req,
                userId: user.UserID,
                userName: user.Name,

                module: "Auth",
                actionType: "LOGIN_FAILED",

                description: `Invalid password for ${user.Email}`,

                status: "FAILED"
            });

            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        /* =========================
           ROLE
        ========================= */
        const role =
            user.RoleID === 1
                ? "Admin"
                : "User";

        /* =========================
           UPDATE LAST LOGIN
        ========================= */
        await pool.request()
            .input('UserID', user.UserID)
            .query(`
                UPDATE Users
                SET
                    LastLogin = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE UserID = @UserID
            `);

        /* =========================
           CREATE TOKEN
        ========================= */
        const token = jwt.sign(
            {
                userId: user.UserID,
                role,
                email: user.Email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        /* =========================
           AUDIT SUCCESS LOGIN
        ========================= */
        await logAudit({
            req,
            userId: user.UserID,
            userName: user.Name,

            module: "Auth",
            actionType: "LOGIN_SUCCESS",

            description: `${user.Name} logged in successfully`,

            newValues: {
                email: user.Email,
                role
            },

            status: "SUCCESS"
        });

        return res.json({
            success: true,
            token,
            role,
            user: {
                id: user.UserID,
                name: user.Name,
                email: user.Email
            }
        });

    } catch (err) {

        console.error("LOGIN ERROR:", err);

        await logAudit({
            req,

            module: "Auth",
            actionType: "LOGIN_ERROR",

            description: err.message,

            status: "ERROR"
        });

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

/* =================================================
   CURRENCY
================================================= */
router.get('/currency', async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT TOP 1 Value
            FROM Settings
            WHERE KeyName='Currency'
        `);

        res.json(
            result.recordset[0] || { Value: "$" }
        );

    } catch (err) {

        console.error("CURRENCY ERROR:", err);

        res.status(500).json({
            message: "Error fetching currency"
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

        const userRes = await pool.request()
            .input('Email', email)
            .query(`
                SELECT *
                FROM Users
                WHERE Email=@Email
            `);

        /* =========================
           USER NOT FOUND
        ========================= */
        if (!userRes.recordset.length) {

            await logAudit({
                req,

                module: "Auth",
                actionType: "FORGOT_PASSWORD_UNKNOWN_EMAIL",

                description: `Forgot password requested for non-existing email: ${email}`,

                newValues: {
                    email
                },

                status: "FAILED"
            });

            return res.json({
                success: true,
                message: "If email exists, reset link sent"
            });
        }

        const user = userRes.recordset[0];

        /* =========================
           GENERATE TOKEN
        ========================= */
        const token =
            crypto.randomBytes(32).toString('hex');

        /* =========================
           SAVE TOKEN
        ========================= */
        await pool.request()
            .input('UserID', user.UserID)
            .input('Token', token)
            .input(
                'Expiry',
                new Date(Date.now() + 3600000)
            )
            .query(`
                INSERT INTO PasswordResetTokens
                (
                    UserID,
                    Token,
                    Expiry
                )
                VALUES
                (
                    @UserID,
                    @Token,
                    @Expiry
                )
            `);

        console.log(
            `Reset link: https://hrinfo-ecommerece.onrender.com/reset-password/${token}`
        );

        /* =========================
           AUDIT
        ========================= */
        await logAudit({
            req,
            userId: user.UserID,
            userName: user.Name,

            module: "Auth",
            actionType: "FORGOT_PASSWORD",

            description: `Password reset requested for ${user.Email}`,

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Reset link sent"
        });

    } catch (err) {

        console.error("FORGOT PASSWORD ERROR:", err);

        await logAudit({
            req,

            module: "Auth",
            actionType: "FORGOT_PASSWORD_ERROR",

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
   RESET PASSWORD
================================================= */
router.post('/reset-password', async (req, res) => {

    try {

        const { token, newPassword } = req.body;

        const pool = await poolPromise;

        /* =========================
           VALIDATE TOKEN
        ========================= */
        const tokenRes = await pool.request()
            .input('Token', token)
            .query(`
                SELECT *
                FROM PasswordResetTokens
                WHERE Token=@Token
                AND Expiry > GETDATE()
            `);

        /* =========================
           INVALID TOKEN
        ========================= */
        if (!tokenRes.recordset.length) {

            await logAudit({
                req,

                module: "Auth",
                actionType: "PASSWORD_RESET_FAILED",

                description: "Invalid or expired reset token",

                status: "FAILED"
            });

            return res.status(400).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        const userId =
            tokenRes.recordset[0].UserID;

        /* =========================
           GET OLD PASSWORD
        ========================= */
        const oldUser = await pool.request()
            .input('UserID', userId)
            .query(`
                SELECT PasswordHash
                FROM Users
                WHERE UserID=@UserID
            `);

        /* =========================
           HASH NEW PASSWORD
        ========================= */
        const hashed =
            await bcrypt.hash(newPassword, 10);

        /* =========================
           UPDATE PASSWORD
        ========================= */
        await pool.request()
            .input('UserID', userId)
            .input('PasswordHash', hashed)
            .query(`
                UPDATE Users
                SET
                    PasswordHash=@PasswordHash,
                    UpdatedAt=GETDATE()
                WHERE UserID=@UserID
            `);

        /* =========================
           REMOVE USED TOKEN
        ========================= */
        await pool.request()
            .input('Token', token)
            .query(`
                DELETE FROM PasswordResetTokens
                WHERE Token=@Token
            `);

        /* =========================
           AUDIT
        ========================= */
        await logAudit({
            req,
            userId,

            module: "Auth",
            actionType: "PASSWORD_RESET",

            description: "Password updated successfully",

            oldValues: {
                password: oldUser.recordset[0]?.PasswordHash
                    ? "OLD_PASSWORD_EXISTS"
                    : null
            },

            newValues: {
                password: "PASSWORD_CHANGED"
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err) {

        console.error("RESET PASSWORD ERROR:", err);

        await logAudit({
            req,

            module: "Auth",
            actionType: "RESET_PASSWORD_ERROR",

            description: err.message,

            status: "ERROR"
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;