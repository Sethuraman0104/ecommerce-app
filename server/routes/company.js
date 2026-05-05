const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');
const sql = require('mssql');

/* =========================
   GET COMPANY
========================= */
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT TOP 1 
                CompanyID,
                Name,
                Email,
                Phone,
                Website,
                Address,
                Logo,
                MimeType,
                CreatedAt,
                UpdatedAt
            FROM CompanyProfile
            ORDER BY CompanyID DESC
        `);

        const data = result.recordset[0];

        if (!data) return res.json({});

        if (data.Logo) {
            const mime = data.MimeType || 'image/png';
            data.Logo =
                `data:${mime};base64,${Buffer.from(data.Logo).toString('base64')}`;
        }

        res.json(data);

    } catch (err) {
        console.error("GET COMPANY ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


/* =========================
   SAVE / UPDATE COMPANY (FIXED 100%)
========================= */
router.post('/', async (req, res) => {
    try {

        const {
            name,
            email,
            phone,
            website,
            address,
            logoBase64,
            mimeType
        } = req.body;

        const pool = await poolPromise;

        // 🔥 SAFE IMAGE CONVERT
        let logoBuffer = null;

        if (logoBase64 && typeof logoBase64 === "string") {
            logoBuffer = Buffer.from(logoBase64, 'base64');
        }

        // Get existing company
        const existing = await pool.request().query(`
            SELECT TOP 1 CompanyID FROM CompanyProfile ORDER BY CompanyID DESC
        `);

        const companyId = existing.recordset[0]?.CompanyID;

        // 🔥 CREATE REQUEST
        const request = pool.request()
            .input('Name', sql.NVarChar, name || null)
            .input('Email', sql.NVarChar, email || null)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Website', sql.NVarChar, website || null)
            .input('Address', sql.NVarChar, address || null)
            .input('MimeType', sql.NVarChar, mimeType || null);

        // 🔥 IMPORTANT FIX FOR IMAGE TYPE
        if (logoBuffer) {
            request.input('Logo', sql.VarBinary(sql.MAX), logoBuffer);
        } else {
            request.input('Logo', sql.VarBinary(sql.MAX), null);
        }

        /* =========================
           UPDATE
        ========================= */
        if (companyId) {

            request.input('CompanyID', sql.Int, companyId);

            await request.query(`
                UPDATE CompanyProfile
                SET
                    Name = @Name,
                    Email = @Email,
                    Phone = @Phone,
                    Website = @Website,
                    Address = @Address,
                    Logo = COALESCE(@Logo, Logo),
                    MimeType = COALESCE(@MimeType, MimeType),
                    UpdatedAt = GETDATE()
                WHERE CompanyID = @CompanyID
            `);

        } 
        /* =========================
           INSERT
        ========================= */
        else {

            await request.query(`
                INSERT INTO CompanyProfile
                (Name, Email, Phone, Website, Address, Logo, MimeType, CreatedAt)
                VALUES
                (@Name, @Email, @Phone, @Website, @Address, @Logo, @MimeType, GETDATE())
            `);
        }

        res.json({ message: "Company Saved Successfully" });

    } catch (err) {
        console.error("SAVE COMPANY ERROR:", err);
        res.status(500).json({
            message: "Save failed",
            error: err.message
        });
    }
});

module.exports = router;