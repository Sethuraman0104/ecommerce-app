const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');

const logAudit = require('../utils/auditLogger'); // 👈 adjust path if needed

// ==========================
// GET COMPANY + SETTINGS
// ==========================
router.get('/app-info', async (req, res) => {
    try {
        const pool = await poolPromise;

        // =========================
        // COMPANY PROFILE
        // =========================
        const companyRes = await pool.request().query(`
            SELECT TOP 1 Name, Logo, MimeType 
            FROM CompanyProfile
        `);

        let company = {};

        if (companyRes.recordset.length > 0) {
            const row = companyRes.recordset[0];

            let logoBase64 = null;

            if (row.Logo) {
                const base64 = Buffer.from(row.Logo).toString('base64');
                logoBase64 = `data:${row.MimeType || 'image/png'};base64,${base64}`;
            }

            company = {
                Name: row.Name,
                Logo: logoBase64
            };
        }

        // =========================
        // SETTINGS
        // =========================
        const settingsRes = await pool.request().query(`
            SELECT KeyName, Value 
            FROM Settings 
            WHERE KeyName IN ('DevelopedBy', 'CopyrightsCompanyName')
        `);

        const settingsMap = {};
        settingsRes.recordset.forEach(s => {
            settingsMap[s.KeyName] = s.Value;
        });

        // =========================
        // AUDIT LOG (VIEW APP INFO)
        // =========================
        await logAudit({
            req,
            userId: null, // public endpoint
            userName: null,
            module: "APP_INFO",
            actionType: "VIEW",
            description: "Public app info accessed",
            newValues: {
                companyName: company?.Name || null,
                settingsLoaded: Object.keys(settingsMap)
            },
            status: "SUCCESS"
        });

        res.json({
            company,
            developedBy: settingsMap["DevelopedBy"] || "",
            copyrightCompany: settingsMap["CopyrightsCompanyName"] || ""
        });

    } catch (err) {
        console.error("APP INFO ERROR:", err);

        // =========================
        // AUDIT FAILURE (NON-BLOCKING)
        // =========================
        await logAudit({
            req,
            userId: null,
            userName: null,
            module: "APP_INFO",
            actionType: "VIEW",
            description: "App info fetch failed",
            status: "FAILED"
        });

        res.status(500).json({ message: err.message });
    }
});

module.exports = router;