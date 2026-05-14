const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { poolPromise } = require('../config/db');

const logAudit = require('../utils/auditLogger');
const getCurrentUser = require('../utils/getCurrentUser');

/* =========================
   AUTH MIDDLEWARE
========================= */
function verifyToken(req, res, next) {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
}

/* =========================
   GET PROFILE (AUDIT LOG)
========================= */
router.get('/', verifyToken, async (req, res) => {

    const currentUser = getCurrentUser(req);

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

        if (user.Photo && user.MimeType) {
            user.Photo =
                `data:${user.MimeType};base64,${Buffer.from(user.Photo).toString('base64')}`;
        }

        // =========================
        // AUDIT: VIEW PROFILE
        // =========================
        await logAudit({
            req,
            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Unknown",
            module: "PROFILE",
            actionType: "VIEW",
            description: "User viewed profile",
            newValues: {
                UserID: user.UserID
            },
            status: "SUCCESS"
        });

        res.json(user);

    } catch (err) {

        console.error(err);

        await logAudit({
            req,
            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Unknown",
            module: "PROFILE",
            actionType: "VIEW_FAILED",
            description: "Failed to view profile",
            status: "FAILED",
            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});


/* =========================
   UPDATE PROFILE (AUDIT LOG)
========================= */
router.post('/', verifyToken, async (req, res) => {

    const currentUser = getCurrentUser(req);

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

        // OLD VALUES
        const oldResult = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT Name, Email, Username
                FROM Users
                WHERE UserID=@UserID
            `);

        const oldValues = oldResult.recordset[0];

        // UPDATE
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

        // =========================
        // AUDIT: SUCCESS
        // =========================
        await logAudit({
            req,
            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Unknown",
            module: "PROFILE",
            actionType: "UPDATE",
            description: "User updated profile",
            oldValues,
            newValues: {
                Name: name,
                Email: email,
                Username: username,
                PhotoUpdated: !!photoBase64
            },
            status: "SUCCESS"
        });

        res.json({ message: "Profile updated successfully" });

    } catch (err) {

        console.error(err);

        await logAudit({
            req,
            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Unknown",
            module: "PROFILE",
            actionType: "UPDATE_FAILED",
            description: "Profile update failed",
            status: "FAILED",
            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});

module.exports = router;