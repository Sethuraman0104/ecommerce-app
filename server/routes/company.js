const express = require('express');
const router = express.Router();

const { poolPromise } = require('../config/db');
const sql = require('mssql');

const logAudit = require('../utils/auditLogger');
const getCurrentUser = require('../utils/getCurrentUser'); // ✅ STANDARD

/* =================================================
   GET COMPANY PROFILE
================================================= */
router.get('/', async (req, res) => {

    const currentUser = getCurrentUser(req); // ✅ STANDARD

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

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Company",
            actionType: "COMPANY_VIEW",
            description: "Viewed company profile",
            status: "SUCCESS"
        });

        if (!data) return res.json({});

        // Convert logo
        if (data.Logo) {
            const mime = data.MimeType || 'image/png';
            data.Logo = `data:${mime};base64,${Buffer.from(data.Logo).toString('base64')}`;
        }

        res.json(data);

    } catch (err) {

        console.error("GET COMPANY ERROR:", err);

        const currentUser = getCurrentUser(req);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Company",
            actionType: "COMPANY_VIEW_FAILED",
            description: "Failed to load company profile",
            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({ message: "Server error" });
    }
});

/* =================================================
   SAVE / UPDATE COMPANY PROFILE
================================================= */
router.post('/', async (req, res) => {

    const currentUser = getCurrentUser(req); // ✅ STANDARD

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

        const existing = await pool.request().query(`
            SELECT TOP 1 *
            FROM CompanyProfile
            ORDER BY CompanyID DESC
        `);

        const existingCompany = existing.recordset[0];

        let logoBuffer = null;

        if (logoBase64 && typeof logoBase64 === "string") {
            logoBuffer = Buffer.from(logoBase64, 'base64');
        }

        const request = pool.request()
            .input('Name', sql.NVarChar, name || null)
            .input('Email', sql.NVarChar, email || null)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Website', sql.NVarChar, website || null)
            .input('Address', sql.NVarChar, address || null)
            .input('MimeType', sql.NVarChar, mimeType || null)
            .input('Logo', sql.VarBinary(sql.MAX), logoBuffer);

        /* =========================
           UPDATE
        ========================= */
        if (existingCompany) {

            request.input('CompanyID', sql.Int, existingCompany.CompanyID);

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

            await logAudit({
                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Company",
                actionType: "COMPANY_UPDATED",
                description: `Updated company profile "${existingCompany.Name || ''}"`,

                oldValues: {
                    name: existingCompany.Name,
                    email: existingCompany.Email,
                    phone: existingCompany.Phone,
                    website: existingCompany.Website,
                    address: existingCompany.Address
                },

                newValues: {
                    name,
                    email,
                    phone,
                    website,
                    address,
                    logoUpdated: !!logoBuffer
                },

                status: "SUCCESS"
            });

        } else {

            await request.query(`
                INSERT INTO CompanyProfile
                (
                    Name,
                    Email,
                    Phone,
                    Website,
                    Address,
                    Logo,
                    MimeType,
                    CreatedAt
                )
                VALUES
                (
                    @Name,
                    @Email,
                    @Phone,
                    @Website,
                    @Address,
                    @Logo,
                    @MimeType,
                    GETDATE()
                )
            `);

            await logAudit({
                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Company",
                actionType: "COMPANY_CREATED",
                description: `Created company profile "${name}"`,

                newValues: {
                    name,
                    email,
                    phone,
                    website,
                    address,
                    logoUploaded: !!logoBuffer
                },

                status: "SUCCESS"
            });
        }

        res.json({
            success: true,
            message: "Company Saved Successfully"
        });

    } catch (err) {

        console.error("SAVE COMPANY ERROR:", err);

        const currentUser = getCurrentUser(req);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Company",
            actionType: "COMPANY_SAVE_FAILED",
            description: "Failed to save company profile",
            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            success: false,
            message: "Save failed",
            error: err.message
        });
    }
});

module.exports = router;