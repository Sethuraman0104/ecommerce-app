const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');
const sql = require('mssql');

// =========================
// GET PAYMENTS
// =========================
router.get('/', async (req, res) => {

    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                p.PaymentID,
                p.OrderID,
                c.FullName AS CustomerName,

                ISNULL(o.SubTotal, 0) AS SubTotal,
                ISNULL(o.VATPercent, 0) AS VATPercent,
                ISNULL(o.VATAmount, 0) AS VATAmount,

                ISNULL(o.AdditionalPercent, 0) AS AdditionalPercent,
                ISNULL(o.AdditionalAmount, 0) AS AdditionalAmount,

                ISNULL(o.DiscountAmount, 0) AS DiscountAmount,
                ISNULL(o.TotalAmount, 0) AS Amount,

                p.PaymentMethod,
                p.PaymentStatus,
                p.TransactionID,
                p.PaidAt

            FROM Payments p
            LEFT JOIN Orders o ON p.OrderID = o.OrderID
            LEFT JOIN Customers c ON o.CustomerID = c.CustomerID

            ORDER BY p.PaymentID DESC
        `);

        res.json(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// =========================
// UPDATE PAYMENT STATUS
// =========================
router.put('/:id/status', async (req, res) => {

    const { status, remarks } = req.body;

    if (!status || !remarks) {
        return res.status(400).json({ message: "Status and remarks required" });
    }

    try {

        const pool = await poolPromise;

        // get old status
        const old = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("SELECT PaymentStatus FROM Payments WHERE PaymentID=@id");

        const oldStatus = old.recordset[0]?.PaymentStatus;

        // update
        await pool.request()
            .input("id", sql.Int, req.params.id)
            .input("status", sql.NVarChar, status)
            .query(`
                UPDATE Payments
                SET PaymentStatus=@status
                WHERE PaymentID=@id
            `);

        // insert history
        await pool.request()
            .input("pid", sql.Int, req.params.id)
            .input("old", sql.NVarChar, oldStatus)
            .input("new", sql.NVarChar, status)
            .input("remarks", sql.NVarChar, remarks)
            .query(`
                INSERT INTO PaymentStatusHistory
                (PaymentID, OldStatus, NewStatus, Remarks)
                VALUES (@pid, @old, @new, @remarks)
            `);

        res.json({ message: "Status updated" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Update failed" });
    }
});

// =========================
// GET HISTORY
// =========================
router.get('/:id/history', async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM PaymentStatusHistory
                WHERE PaymentID=@id
                ORDER BY HistoryID DESC
            `);

        res.json(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "History load failed" });
    }
});

module.exports = router;