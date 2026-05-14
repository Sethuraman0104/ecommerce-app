const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');
const sql = require('mssql');
const logAudit = require('../utils/auditLogger');

const getCurrentUser = require('../utils/getCurrentUser');

// =========================
// GET PAYMENTS
// =========================
router.get('/', async (req, res) => {

    const currentUser = getCurrentUser(req);

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
                ISNULL(o.DiscountPercent, 0) AS DiscountPercent,
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

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_LIST_VIEW",
            description: "Viewed payments list",
            status: "SUCCESS",
            newValues: {
                total: result.recordset.length
            }
        });

        res.json(result.recordset);

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_LIST_FAILED",
            description: "Failed to load payments list",
            status: "FAILED",
            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: "Server error" });
    }
});


// =========================
// UPDATE PAYMENT STATUS
// =========================
router.put('/:id/status', async (req, res) => {

    const currentUser = getCurrentUser(req);

    const { status, remarks } = req.body;

    if (!status || !remarks) {

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_STATUS_UPDATE_INVALID",
            description: "Status update failed - missing fields",
            status: "FAILED"
        });

        return res.status(400).json({ message: "Status and remarks required" });
    }

    try {

        const pool = await poolPromise;

        const old = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("SELECT PaymentStatus FROM Payments WHERE PaymentID=@id");

        const oldStatus = old.recordset[0]?.PaymentStatus;

        await pool.request()
            .input("id", sql.Int, req.params.id)
            .input("status", sql.NVarChar, status)
            .query(`
                UPDATE Payments
                SET PaymentStatus=@status
                WHERE PaymentID=@id
            `);

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

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_STATUS_UPDATED",
            description: `Payment status updated (PaymentID=${req.params.id})`,
            status: "SUCCESS",
            newValues: {
                paymentId: req.params.id,
                oldStatus,
                newStatus: status,
                remarks
            }
        });

        res.json({ message: "Status updated" });

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_STATUS_UPDATE_FAILED",
            description: "Payment status update failed",
            status: "FAILED",
            newValues: {
                error: err.message,
                paymentId: req.params.id
            }
        });

        res.status(500).json({ message: "Update failed" });
    }
});


// =========================
// GET HISTORY
// =========================
router.get('/:id/history', async (req, res) => {

    const currentUser = getCurrentUser(req);

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

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_HISTORY_VIEW",
            description: `Viewed payment history (PaymentID=${req.params.id})`,
            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {
        console.error(err);

        await logAudit({
            req,
            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Payment",
            actionType: "PAYMENT_HISTORY_FAILED",
            description: "Failed to load payment history",
            status: "FAILED",
            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: "History load failed" });
    }
});

module.exports = router;