const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');

// ==========================
// GET COMPANY + SETTINGS
// ==========================
router.get('/app-info', async (req, res) => {
    try {
        const pool = await poolPromise;

        // ✅ FIXED TABLE NAME
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

        // SETTINGS
        const settingsRes = await pool.request().query(`
            SELECT KeyName, Value 
            FROM Settings 
            WHERE KeyName IN ('DevelopedBy', 'CopyrightsCompanyName')
        `);

        const settingsMap = {};
        settingsRes.recordset.forEach(s => {
            settingsMap[s.KeyName] = s.Value;
        });

        res.json({
            company,
            developedBy: settingsMap["DevelopedBy"] || "",
            copyrightCompany: settingsMap["CopyrightsCompanyName"] || ""
        });

    } catch (err) {
        console.error("APP INFO ERROR:", err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;