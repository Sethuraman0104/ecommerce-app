const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");


// =========================
// GET ORDERS (LIST)
// =========================
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                o.OrderID,
                o.TotalAmount,
                o.Status,
                o.CreatedAt,
                o.CustomerRemarks,
                o.AdminRemarks,

                c.CustomerID,
                c.FullName AS CustomerName,
                c.Email,
                c.Phone,
                c.AddressLine1,
                c.City,
                c.Country,

                p.PaymentMethod,
                p.PaymentStatus,
                p.TransactionID,
                p.PaidAt

            FROM Orders o
            LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
            LEFT JOIN Payments p ON o.OrderID = p.OrderID

            ORDER BY o.OrderID DESC
        `);

        res.json(result.recordset);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


// =========================
// ORDER DETAILS
// =========================
router.get("/:id/details", async (req, res) => {
    try {
        const pool = await poolPromise;
        const orderId = req.params.id;

        const orderResult = await pool.request()
            .input("OrderID", sql.Int, orderId)
            .query(`
                SELECT 
                    o.OrderID,
                    o.TotalAmount,
                    o.Status,
                    o.CreatedAt,
                    o.CustomerRemarks,
                    o.AdminRemarks,

                    c.CustomerID,
                    c.FullName,
                    c.Email,
                    c.Phone,
                    c.AddressLine1,
                    c.AddressLine2,
                    c.City,
                    c.State,
                    c.Country,
                    c.PostalCode

                FROM Orders o
                LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
                WHERE o.OrderID = @OrderID
            `);

        const itemsResult = await pool.request()
            .input("OrderID", sql.Int, orderId)
            .query(`
                SELECT 
                    oi.OrderItemID,
                    oi.ProductID,
                    p.Name AS ProductName,
                    oi.Quantity,
                    oi.Price,
                    (oi.Quantity * oi.Price) AS LineTotal
                FROM OrderItems oi
                LEFT JOIN Products p ON oi.ProductID = p.ProductID
                WHERE oi.OrderID = @OrderID
            `);

        const paymentResult = await pool.request()
            .input("OrderID", sql.Int, orderId)
            .query(`
                SELECT * FROM Payments
                WHERE OrderID = @OrderID
            `);

        res.json({
            order: orderResult.recordset[0] || null,
            items: itemsResult.recordset,
            payment: paymentResult.recordset[0] || null
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


// =========================
// UPDATE STATUS + ADMIN REMARKS (HISTORY)
// =========================
router.put("/:id/status", async (req, res) => {
    try {

        const allowed = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        const { status, adminRemarks } = req.body;

        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const pool = await poolPromise;

        // 1. update status
        await pool.request()
            .input("OrderID", sql.Int, req.params.id)
            .input("Status", sql.NVarChar, status)
            .query(`
                UPDATE Orders
                SET Status = @Status
                WHERE OrderID = @OrderID
            `);

        // 2. update latest admin remark in Orders table
        if (adminRemarks) {
            await pool.request()
                .input("OrderID", sql.Int, req.params.id)
                .input("AdminRemarks", sql.NVarChar, adminRemarks)
                .query(`
                    UPDATE Orders
                    SET AdminRemarks = @AdminRemarks
                    WHERE OrderID = @OrderID
                `);

            // 3. insert history
            await pool.request()
                .input("OrderID", sql.Int, req.params.id)
                .input("Status", sql.NVarChar, status)
                .input("Remarks", sql.NVarChar, adminRemarks)
                .input("CreatedBy", sql.NVarChar, "Admin")
                .query(`
                    INSERT INTO OrderRemarksHistory
                    (OrderID, Status, Remarks, CreatedBy, CreatedAt)
                    VALUES
                    (@OrderID, @Status, @Remarks, @CreatedBy, GETDATE())
                `);
        }

        res.json({ message: "Order updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


// =========================
// REMARKS HISTORY
// =========================
router.get("/:id/remarks", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("OrderID", sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM OrderRemarksHistory
                WHERE OrderID = @OrderID
                ORDER BY CreatedAt DESC
            `);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// =========================
// DELETE ORDER
// =========================
router.delete("/:id", async (req, res) => {
    try {
        const pool = await poolPromise;
        const orderId = req.params.id;

        const check = await pool.request()
            .input("OrderID", sql.Int, orderId)
            .query(`
                SELECT o.Status, p.PaymentStatus
                FROM Orders o
                LEFT JOIN Payments p ON o.OrderID = p.OrderID
                WHERE o.OrderID = @OrderID
            `);

        const order = check.recordset[0];

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (!(order.Status === "Cancelled" && (order.PaymentStatus || "").toLowerCase() === "failed")) {
            return res.status(400).json({
                message: "Only cancelled + failed orders can be deleted"
            });
        }

        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM OrderItems WHERE OrderID = @OrderID`);

        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM Payments WHERE OrderID = @OrderID`);

        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM Orders WHERE OrderID = @OrderID`);

        res.json({ message: "Order deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;