const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");

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

        res.json(result.recordset);

    } catch (err) {
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

        for (let item of items) {
            await pool.request()
                .input("KeyName", sql.NVarChar, item.keyName)
                .input("Value", sql.NVarChar, item.value)
                .query(`
                    UPDATE Settings
                    SET Value = @Value
                    WHERE KeyName = @KeyName
                `);
        }

        res.json({ message: "Settings updated successfully" });

    } catch (err) {
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

        res.json(result.recordset);

    } catch (err) {
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

        if (CurrencyID) {

            request.input("CurrencyID", sql.Int, CurrencyID);

            await request.query(`
                UPDATE Currencies
                SET Code=@Code, Name=@Name, Symbol=@Symbol, IsActive=@IsActive
                WHERE CurrencyID=@CurrencyID
            `);

        } else {

            await request.query(`
                INSERT INTO Currencies(Code, Name, Symbol, IsActive)
                VALUES(@Code, @Name, @Symbol, @IsActive)
            `);
        }

        res.json({ message: "Saved" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;