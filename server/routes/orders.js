const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const jwt = require("jsonwebtoken");

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

        // ================= ORDER =================
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

                    o.VATPercent,
                    o.VATAmount,

                    o.AdditionalPercent,
                    o.AdditionalAmount,

                    o.DiscountAmount,
                    o.CouponID,

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

        // ================= ITEMS =================
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

        // ================= PAYMENT =================
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

router.post("/full-create", async (req, res) => {

    try {

        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ success: false });

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const customerId = decoded.customerId;

        const {
            Items,
            SubTotal,
            VAT,
            AdditionalCharges,
            DiscountAmount,
            CouponID,
            GrandTotal,
            PaymentMethod,
            PaymentStatus
        } = req.body;

        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {

            // ===============================
            // ORDER STATUS
            // ===============================
            const orderStatus = "Processing";

            // ===============================
            // PAYMENT LOGIC
            // ===============================
            const isCOD =
                PaymentMethod === "COD" ||
                PaymentMethod === "Cash";

            const finalPaymentStatus = isCOD
                ? "Pending"
                : (PaymentStatus || "Success");

            const transactionId = isCOD
                ? null
                : "TXN" + Date.now();

            // ===============================
            // EXTRACT VAT / ADDITIONAL
            // ===============================
            const vatPercent = VAT?.percent || 0;
            const vatAmount = VAT?.amount || 0;

            const addPercent = AdditionalCharges?.percent || 0;
            const addAmount = AdditionalCharges?.amount || 0;

            // ===============================
            // CREATE ORDER
            // ===============================
            const orderResult = await new sql.Request(transaction)
                .input("CustomerID", sql.Int, customerId)
                .input("TotalAmount", sql.Decimal(18, 2), GrandTotal)
                .input("Status", sql.NVarChar, orderStatus)

                .input("CouponID", sql.Int, CouponID)
                .input("DiscountAmount", sql.Decimal(18, 2), DiscountAmount || 0)

                .input("VATPercent", sql.Decimal(5, 2), vatPercent)
                .input("VATAmount", sql.Decimal(18, 2), vatAmount)

                .input("AdditionalPercent", sql.Decimal(5, 2), addPercent)
                .input("AdditionalAmount", sql.Decimal(18, 2), addAmount)
                .input("SubTotal", sql.Decimal(18, 2), SubTotal)

                .query(`
                    INSERT INTO Orders
                    (
                        CustomerID,
                        TotalAmount,
                        Status,
                        CreatedAt,

                        CouponID,
                        DiscountAmount,

                        VATPercent,
                        VATAmount,

                        AdditionalPercent,
                        AdditionalAmount,
                        SubTotal
                    )
                    OUTPUT INSERTED.OrderID
                    VALUES
                    (
                        @CustomerID,
                        @TotalAmount,
                        @Status,
                        GETDATE(),

                        @CouponID,
                        @DiscountAmount,

                        @VATPercent,
                        @VATAmount,

                        @AdditionalPercent,
                        @AdditionalAmount,
                        @SubTotal
                    )
                `);

            const orderId = orderResult.recordset[0].OrderID;

            // ===============================
            // ORDER ITEMS
            // ===============================
            for (let item of Items) {

                await new sql.Request(transaction)
                    .input("OrderID", sql.Int, orderId)
                    .input("ProductID", sql.Int, item.ProductID)
                    .input("Quantity", sql.Int, item.Qty)
                    .input("Price", sql.Decimal(18, 2), item.Price)
                    .query(`
                        INSERT INTO OrderItems
                        (OrderID, ProductID, Quantity, Price)
                        VALUES
                        (@OrderID, @ProductID, @Quantity, @Price)
                    `);
            }

            // ===============================
            // PAYMENT INSERT
            // ===============================
            await new sql.Request(transaction)
                .input("OrderID", sql.Int, orderId)
                .input("PaymentMethod", sql.NVarChar, PaymentMethod)
                .input("PaymentStatus", sql.NVarChar, finalPaymentStatus)
                .input("TransactionID", sql.NVarChar, transactionId)
                .query(`
                    INSERT INTO Payments
                    (OrderID, PaymentMethod, PaymentStatus, TransactionID, PaidAt)
                    VALUES
                    (@OrderID, @PaymentMethod, @PaymentStatus, @TransactionID, GETDATE())
                `);

            // ===============================
            // COMMIT
            // ===============================
            await transaction.commit();

            res.json({
                success: true,
                orderId,
                paymentStatus: finalPaymentStatus,
                transactionId
            });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;