const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");

const logAudit = require("../utils/auditLogger"); // ✅ adjust path if needed

/* =========================
   SETTINGS GET
========================= */
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT SettingID, KeyName, Value
            FROM Settings
        `);

        // 🔵 AUDIT LOG (READ SETTINGS)
        await logAudit({
            req,
            userId: null,
            module: "Settings",
            actionType: "READ",
            description: "Viewed application settings"
        });

        res.json(result.recordset);

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: null,
            module: "Settings",
            actionType: "READ",
            description: "Failed to load settings",
            status: "FAILED"
        });

        res.status(500).json({ message: "Server error" });
    }
});

/* =========================
   SETTINGS UPDATE
========================= */
router.put("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        const items = req.body;

        const oldValues = [];

        for (let item of items) {

            // get old value for audit
            const old = await pool.request()
                .input("KeyName", sql.NVarChar, item.keyName)
                .query(`
                    SELECT Value FROM Settings WHERE KeyName = @KeyName
                `);

            oldValues.push({
                keyName: item.keyName,
                oldValue: old.recordset[0]?.Value,
                newValue: item.value
            });

            await pool.request()
                .input("KeyName", sql.NVarChar, item.keyName)
                .input("Value", sql.NVarChar, item.value)
                .query(`
                    UPDATE Settings
                    SET Value = @Value
                    WHERE KeyName = @KeyName
                `);
        }

        // 🔵 AUDIT LOG (SETTINGS UPDATE)
        await logAudit({
            req,
            userId: null,
            module: "Settings",
            actionType: "UPDATE",
            description: "Updated system settings",
            oldValues,
            newValues: items,
            status: "SUCCESS"
        });

        res.json({ message: "Settings updated successfully" });

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: null,
            module: "Settings",
            actionType: "UPDATE",
            description: "Failed to update settings",
            status: "FAILED"
        });

        res.status(500).json({ message: "Update failed" });
    }
});

/* =========================
   CURRENCIES LIST
========================= */
router.get("/currencies", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT CurrencyID, Code, Name, Symbol, IsActive
            FROM Currencies
            WHERE IsActive = 1
            ORDER BY Code
        `);

        // 🔵 AUDIT LOG
        await logAudit({
            req,
            userId: null,
            module: "Currency",
            actionType: "READ",
            description: "Viewed active currencies"
        });

        res.json(result.recordset);

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: null,
            module: "Currency",
            actionType: "READ",
            description: "Failed to load currencies",
            status: "FAILED"
        });

        res.status(500).json({ message: err.message });
    }
});

/* =========================
   ADD / UPDATE CURRENCY
========================= */
router.post("/currencies", async (req, res) => {
    try {

        const { CurrencyID, Code, Name, Symbol, IsActive } = req.body;

        const pool = await poolPromise;

        const request = pool.request()
            .input("Code", sql.NVarChar, Code)
            .input("Name", sql.NVarChar, Name)
            .input("Symbol", sql.NVarChar, Symbol)
            .input("IsActive", sql.Bit, IsActive ? 1 : 0);

        let oldData = null;

        if (CurrencyID) {

            // get old
            const old = await pool.request()
                .input("CurrencyID", sql.Int, CurrencyID)
                .query(`
                    SELECT * FROM Currencies WHERE CurrencyID=@CurrencyID
                `);

            oldData = old.recordset[0];

            request.input("CurrencyID", sql.Int, CurrencyID);

            await request.query(`
                UPDATE Currencies
                SET Code=@Code, Name=@Name, Symbol=@Symbol, IsActive=@IsActive
                WHERE CurrencyID=@CurrencyID
            `);

            await logAudit({
                req,
                userId: null,
                module: "Currency",
                actionType: "UPDATE",
                description: `Updated currency ${Code}`,
                oldValues: oldData,
                newValues: { Code, Name, Symbol, IsActive },
                status: "SUCCESS"
            });

        } else {

            await request.query(`
                INSERT INTO Currencies(Code, Name, Symbol, IsActive)
                VALUES(@Code, @Name, @Symbol, @IsActive)
            `);

            await logAudit({
                req,
                userId: null,
                module: "Currency",
                actionType: "CREATE",
                description: `Added new currency ${Code}`,
                newValues: { Code, Name, Symbol, IsActive },
                status: "SUCCESS"
            });
        }

        res.json({ message: "Saved" });

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: null,
            module: "Currency",
            actionType: "ERROR",
            description: "Currency save failed",
            status: "FAILED"
        });

        res.status(500).json({ message: err.message });
    }
});

module.exports = router;