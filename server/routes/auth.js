const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
const { poolPromise } = require('../config/db');


// ==========================
// REGISTER USER
// ==========================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const pool = await poolPromise;

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input('Name', name)
            .input('Email', email)
            .input('PasswordHash', hashedPassword)
            .input('RoleID', 2)
            .input('IsActive', 1)
            .query(`
                INSERT INTO Users (Name, Email, PasswordHash, RoleID, IsActive)
                VALUES (@Name, @Email, @PasswordHash, @RoleID, @IsActive)
            `);

        res.json({ message: "User registered successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const pool = await poolPromise;

        if (!pool) {
            return res.status(500).json({
                message: "Database connection not available"
            });
        }

        const { email, password } = req.body;

        const result = await pool.request()
            .input('Email', email)
            .query(`
                SELECT UserID, Name, Email, PasswordHash, RoleID, IsActive
                FROM Users
                WHERE Email=@Email AND IsActive=1
            `);

        if (!result.recordset.length) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const user = result.recordset[0];

        const valid = await bcrypt.compare(password, user.PasswordHash);

        if (!valid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const role = user.RoleID === 1 ? "Admin" : "User";

        /* =========================
           🔥 UPDATE LAST LOGIN
        ========================= */
        await pool.request()
            .input('UserID', user.UserID)
            .query(`
                UPDATE Users
                SET LastLogin = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE UserID = @UserID
            `);

        const token = jwt.sign(
            {
                userId: user.UserID,
                role,
                email: user.Email
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

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
        return res.status(500).json({ message: "Server error" });
    }
});

router.get('/currency', async (req, res) => {
    const pool = await poolPromise;

    const result = await pool.request().query(`
        SELECT Value FROM Settings WHERE KeyName='Currency'
    `);

    res.json(result.recordset[0]);
});

// ==========================
// FORGOT PASSWORD
// ==========================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const pool = await poolPromise;

        const userRes = await pool.request()
            .input('Email', email)
            .query(`SELECT * FROM Users WHERE Email=@Email`);

        if (userRes.recordset.length === 0) {
            return res.json({ message: "If email exists, reset link sent" });
        }

        const user = userRes.recordset[0];

        const token = crypto.randomBytes(32).toString('hex');

        await pool.request()
            .input('UserID', user.UserID)
            .input('Token', token)
            .input('Expiry', new Date(Date.now() + 3600000))
            .query(`
                INSERT INTO PasswordResetTokens (UserID, Token, Expiry)
                VALUES (@UserID, @Token, @Expiry)
            `);

        console.log(`Reset link: http://localhost:3000/reset-password/${token}`);

        res.json({ message: "Reset link sent (check console)" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================
// RESET PASSWORD
// ==========================
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const pool = await poolPromise;

        const tokenRes = await pool.request()
            .input('Token', token)
            .query(`
                SELECT * FROM PasswordResetTokens 
                WHERE Token=@Token AND Expiry > GETDATE()
            `);

        if (tokenRes.recordset.length === 0)
            return res.status(400).json({ message: "Invalid or expired token" });

        const userId = tokenRes.recordset[0].UserID;

        const hashed = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input('UserID', userId)
            .input('PasswordHash', hashed)
            .query(`
                UPDATE Users 
                SET PasswordHash=@PasswordHash 
                WHERE UserID=@UserID
            `);

        res.json({ message: "Password updated successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;