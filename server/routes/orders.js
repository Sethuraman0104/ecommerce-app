const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const logAudit = require("../utils/auditLogger");

/* =========================
   TOKEN HELPER
========================= */
function getUserFromToken(req) {
    try {
        const auth = req.headers.authorization;
        if (!auth) return null;

        const token = auth.split(" ")[1];
        if (!token) return null;

        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// =========================
// GET ORDERS (LIST)
// =========================
router.get("/", async (req, res) => {

    const currentUser = getUserFromToken(req);

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

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_LIST_VIEW",

            description: "Viewed orders list",

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET ORDERS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_LIST_FAILED",

            description: "Failed to load orders list",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});


// =========================
// ORDER DETAILS
// =========================
router.get("/:id/details", async (req, res) => {

    const currentUser = getUserFromToken(req);

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
                    o.SubTotal,
                    o.Status,
                    o.CreatedAt,
                    o.CustomerRemarks,
                    o.AdminRemarks,

                    o.VATPercent,
                    o.VATAmount,

                    o.AdditionalPercent,
                    o.AdditionalAmount,

                    o.DiscountAmount,
                    o.DiscountPercent,
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
                    p.UnitType,
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

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_DETAILS_VIEW",

            description: `Viewed order details (OrderID=${orderId})`,

            status: "SUCCESS"
        });

        res.json({
            order: orderResult.recordset[0] || null,
            items: itemsResult.recordset,
            payment: paymentResult.recordset[0] || null
        });

    } catch (err) {

        console.error("ORDER DETAILS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_DETAILS_FAILED",

            description: `Failed to load order details (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});
 // =========================
// UPDATE STATUS + ADMIN REMARKS (HISTORY)
// =========================
router.put("/:id/status", async (req, res) => {

    const currentUser = getUserFromToken(req);

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

            // AUDIT FAILED (INVALID STATUS)
            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Orders",
                actionType: "ORDER_STATUS_INVALID",

                description: `Invalid status update attempted: ${status}`,

                status: "FAILED",

                newValues: {
                    orderId: req.params.id,
                    status
                }
            });

            return res.status(400).json({ message: "Invalid status" });
        }

        const pool = await poolPromise;

        // =========================
        // 1. update status
        // =========================
        await pool.request()
            .input("OrderID", sql.Int, req.params.id)
            .input("Status", sql.NVarChar, status)
            .query(`
                UPDATE Orders
                SET Status = @Status
                WHERE OrderID = @OrderID
            `);

        // =========================
        // 2. update admin remarks
        // =========================
        if (adminRemarks) {

            await pool.request()
                .input("OrderID", sql.Int, req.params.id)
                .input("AdminRemarks", sql.NVarChar, adminRemarks)
                .query(`
                    UPDATE Orders
                    SET AdminRemarks = @AdminRemarks
                    WHERE OrderID = @OrderID
                `);

            // =========================
            // 3. insert history
            // =========================
            await pool.request()
                .input("OrderID", sql.Int, req.params.id)
                .input("Status", sql.NVarChar, status)
                .input("Remarks", sql.NVarChar, adminRemarks)
                .input("CreatedBy", sql.NVarChar, currentUser?.email || "Admin")
                .query(`
                    INSERT INTO OrderRemarksHistory
                    (OrderID, Status, Remarks, CreatedBy, CreatedAt)
                    VALUES
                    (@OrderID, @Status, @Remarks, @CreatedBy, GETDATE())
                `);
        }

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_STATUS_UPDATED",

            description: `Order status updated to ${status} (OrderID=${req.params.id})`,

            status: "SUCCESS",

            newValues: {
                orderId: req.params.id,
                status,
                adminRemarks
            }
        });

        res.json({ message: "Order updated successfully" });

    } catch (err) {

        console.error("ORDER STATUS UPDATE ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_STATUS_UPDATE_FAILED",

            description: `Order status update failed (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});

// =========================
// REMARKS HISTORY
// =========================
router.get("/:id/remarks", async (req, res) => {

    const currentUser = getUserFromToken(req);

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

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_REMARKS_VIEW",

            description: `Viewed order remarks history (OrderID=${req.params.id})`,

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("ORDER REMARKS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_REMARKS_FAILED",

            description: `Failed to load order remarks history (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});

// =========================
// DELETE ORDER
// =========================
router.delete("/:id", async (req, res) => {

    const currentUser = getUserFromToken(req);

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

        // =========================
        // NOT FOUND
        // =========================
        if (!order) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Orders",
                actionType: "ORDER_DELETE_NOT_FOUND",

                description: `Delete failed - order not found (OrderID=${orderId})`,

                status: "FAILED"
            });

            return res.status(404).json({ message: "Order not found" });
        }

        // =========================
        // DELETE RULE BLOCK
        // =========================
        if (!(order.Status === "Cancelled" && (order.PaymentStatus || "").toLowerCase() === "failed")) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Orders",
                actionType: "ORDER_DELETE_BLOCKED",

                description: `Delete blocked for OrderID=${orderId} (Status=${order.Status}, Payment=${order.PaymentStatus})`,

                status: "FAILED",

                newValues: {
                    orderId,
                    status: order.Status,
                    paymentStatus: order.PaymentStatus
                }
            });

            return res.status(400).json({
                message: "Only cancelled + failed orders can be deleted"
            });
        }

        // =========================
        // DELETE CHILD RECORDS
        // =========================
        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM OrderItems WHERE OrderID = @OrderID`);

        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM Payments WHERE OrderID = @OrderID`);

        await pool.request().input("OrderID", sql.Int, orderId)
            .query(`DELETE FROM Orders WHERE OrderID = @OrderID`);

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_DELETED",

            description: `Order deleted successfully (OrderID=${orderId})`,

            status: "SUCCESS",

            oldValues: {
                orderId
            }
        });

        res.json({ message: "Order deleted successfully" });

    } catch (err) {

        console.error("ORDER DELETE ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Orders",
            actionType: "ORDER_DELETE_FAILED",

            description: `Order deletion failed (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({ message: err.message });
    }
});
router.post("/full-create", async (req, res) => {

    let orderId = null; // IMPORTANT for audit tracking

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            await logAudit({
                req,
                module: "Order",
                actionType: "ORDER_CREATE_UNAUTHORIZED",
                description: "Order creation blocked - no auth token",
                status: "FAILED"
            });

            return res.status(401).json({
                success: false
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const customerId = decoded.customerId;

        const {
            Items,
            SubTotal,
            VAT,
            AdditionalCharges,
            DiscountAmount,
            DiscountPercent,
            CouponID,
            GrandTotal,
            PaymentMethod,
            PaymentStatus
        } = req.body;

        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {

            const isCOD =
                PaymentMethod === "COD" ||
                PaymentMethod === "Cash";

            const orderStatus =
                isCOD ? "Pending" : "Processing";

            const finalPaymentStatus =
                isCOD ? "Pending" : (PaymentStatus || "Success");

            const transactionId =
                isCOD ? null : "TXN" + Date.now();

            const vatPercent = VAT?.percent || 0;
            const vatAmount = VAT?.amount || 0;

            const addPercent = AdditionalCharges?.percent || 0;
            const addAmount = AdditionalCharges?.amount || 0;

            // ===============================
            // CREATE ORDER
            // ===============================
            const orderResult =
                await new sql.Request(transaction)

                    .input("CustomerID", sql.Int, customerId)
                    .input("TotalAmount", sql.Decimal(18, 2), GrandTotal)
                    .input("Status", sql.NVarChar, orderStatus)
                    .input("CouponID", sql.Int, CouponID)
                    .input("DiscountAmount", sql.Decimal(18, 2), DiscountAmount || 0)
                    .input("DiscountPercent", sql.Decimal(5, 2), DiscountPercent || 0)
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
                            DiscountPercent,

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
                            @DiscountPercent,

                            @VATPercent,
                            @VATAmount,

                            @AdditionalPercent,
                            @AdditionalAmount,
                            @SubTotal
                        )
                    `);

            orderId = orderResult.recordset[0].OrderID;

            // ===============================
            // INSERT ITEMS
            // ===============================
            for (let item of Items) {

                await new sql.Request(transaction)

                    .input("OrderID", sql.Int, orderId)
                    .input("ProductID", sql.Int, item.ProductID)
                    .input("Quantity", sql.Int, item.Qty)
                    .input("Price", sql.Decimal(18, 2), item.Price)

                    .query(`
                        INSERT INTO OrderItems
                        (
                            OrderID,
                            ProductID,
                            Quantity,
                            Price
                        )
                        VALUES
                        (
                            @OrderID,
                            @ProductID,
                            @Quantity,
                            @Price
                        )
                    `);
            }

            // ===============================
            // PAYMENT
            // ===============================
            await new sql.Request(transaction)

                .input("OrderID", sql.Int, orderId)
                .input("PaymentMethod", sql.NVarChar, PaymentMethod)
                .input("PaymentStatus", sql.NVarChar, finalPaymentStatus)
                .input("TransactionID", sql.NVarChar, transactionId)

                .query(`
                    INSERT INTO Payments
                    (
                        OrderID,
                        PaymentMethod,
                        PaymentStatus,
                        TransactionID,
                        PaidAt
                    )
                    VALUES
                    (
                        @OrderID,
                        @PaymentMethod,
                        @PaymentStatus,
                        @TransactionID,
                        GETDATE()
                    )
                `);

            // ===============================
            // COMMIT
            // ===============================
            await transaction.commit();

            // ✅ SUCCESS AUDIT (AFTER COMMIT)
            await logAudit({
                req,
                userId: customerId,
                userName: decoded.email || "Customer",
                module: "Order",
                actionType: "ORDER_CREATED",
                description: `Order created successfully (OrderID=${orderId})`,
                status: "SUCCESS",
                newValues: {
                    orderId,
                    customerId,
                    grandTotal: GrandTotal,
                    paymentMethod: PaymentMethod,
                    orderStatus,
                    paymentStatus: finalPaymentStatus
                }
            });

            res.json({
                success: true,
                orderId,
                orderStatus,
                paymentStatus: finalPaymentStatus,
                transactionId
            });

        } catch (err) {

            await transaction.rollback();

            // ❌ FAILURE AUDIT (INSIDE TRANSACTION)
            await logAudit({
                req,
                userId: customerId,
                userName: decoded?.email || "Customer",
                module: "Order",
                actionType: "ORDER_CREATE_FAILED",
                description: "Order creation failed during transaction",
                status: "FAILED",
                newValues: {
                    error: err.message
                }
            });

            throw err;
        }

    } catch (err) {

        console.error(err);

        // ❌ OUTER FAILURE AUDIT
        await logAudit({
            req,
            module: "Order",
            actionType: "ORDER_CREATE_ERROR",
            description: "Order creation failed (outer catch)",
            status: "FAILED",
            newValues: {
                error: err.message,
                orderId
            }
        });

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ======================================================
// MY ORDERS
// ======================================================
router.get("/my-orders", async (req, res) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            await logAudit({
                req,
                module: "Order",
                actionType: "MY_ORDERS_UNAUTHORIZED",
                description: "My orders access blocked - missing token",
                status: "FAILED"
            });

            return res.status(401).json([]);
        }

        const token = auth.split(" ")[1];

        let decoded;

        try {

            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        } catch (err) {

            await logAudit({
                req,
                module: "Order",
                actionType: "MY_ORDERS_TOKEN_EXPIRED",
                description: "My orders access failed - token expired",
                status: "FAILED"
            });

            return res.status(401).json({
                success: false,
                message: "Session expired"
            });
        }

        const pool = await poolPromise;

        const result = await pool.request()

            .input(
                "CustomerID",
                sql.Int,
                decoded.customerId
            )

            .query(`

                SELECT
                    o.OrderID,
                    o.CreatedAt,
                    o.Status,
                    o.TotalAmount,
                    o.SubTotal,
                    o.VATAmount,
                    o.AdditionalAmount,
                    o.DiscountAmount,
                    o.DiscountPercent,
                    o.AdditionalPercent,
                    o.VATPercent,

                    p.PaymentMethod,
                    p.PaymentStatus

                FROM Orders o

                LEFT JOIN Payments p
                    ON o.OrderID = p.OrderID

                WHERE o.CustomerID = @CustomerID

                ORDER BY o.OrderID DESC

            `);

        // ✅ SUCCESS AUDIT
        await logAudit({
            req,
            userId: decoded.customerId,
            userName: decoded.email || "Customer",
            module: "Order",
            actionType: "MY_ORDERS_VIEW",
            description: "Customer viewed their orders list",
            status: "SUCCESS",
            newValues: {
                customerId: decoded.customerId,
                totalOrdersFetched: result.recordset.length
            }
        });

        res.json(result.recordset);

    } catch (err) {

        console.log(err);

        // ❌ FAILURE AUDIT
        await logAudit({
            req,
            module: "Order",
            actionType: "MY_ORDERS_FAILED",
            description: "Failed to fetch customer orders",
            status: "FAILED",
            newValues: {
                error: err.message
            }
        });

        res.status(500).json([]);
    }
});

module.exports = router;