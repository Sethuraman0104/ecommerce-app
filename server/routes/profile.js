const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { poolPromise } = require('../config/db');

/* =========================
   AUTH MIDDLEWARE
========================= */
function verifyToken(req, res, next) {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
}

/* =========================
   GET PROFILE
========================= */
router.get('/', verifyToken, async (req, res) => {
    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT 
                    UserID,
                    Name,
                    Email,
                    Username,
                    Photo,
                    MimeType,
                    LastLogin,
                    UpdatedAt
                FROM Users
                WHERE UserID=@UserID
            `);

        let user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        /* Convert image */
        if (user.Photo && user.MimeType) {
            user.Photo =
                `data:${user.MimeType};base64,${Buffer.from(user.Photo).toString('base64')}`;
        }

        res.json(user);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   UPDATE PROFILE
========================= */
router.post('/', verifyToken, async (req, res) => {
    try {

        const {
            name,
            email,
            username,
            photoBase64,
            mimeType
        } = req.body;

        const pool = await poolPromise;

        let buffer = null;

        if (photoBase64) {
            buffer = Buffer.from(photoBase64, 'base64');
        }

        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('Name', sql.NVarChar, name)
            .input('Email', sql.NVarChar, email)
            .input('Username', sql.NVarChar, username)
            .input('Photo', sql.VarBinary(sql.MAX), buffer)
            .input('MimeType', sql.NVarChar, mimeType)
            .query(`
                UPDATE Users
                SET 
                    Name = @Name,
                    Email = @Email,
                    Username = @Username,
                    Photo = CASE WHEN @Photo IS NULL THEN Photo ELSE @Photo END,
                    MimeType = CASE WHEN @MimeType IS NULL THEN MimeType ELSE @MimeType END,
                    UpdatedAt = GETDATE()
                WHERE UserID = @UserID
            `);

        res.json({ message: "Profile updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;