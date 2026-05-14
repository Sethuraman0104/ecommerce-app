const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const logAudit = require("../utils/auditLogger");

const getCurrentUser = require("../utils/getCurrentUser");

// =========================
// GET ORDERS (LIST)
// =========================
router.get("/", async (req, res) => {

    // =========================
    // GET CURRENT LOGGED USER
    // =========================
    const currentUser = getCurrentUser(req);

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

            LEFT JOIN Customers c
                ON o.CustomerID = c.CustomerID

            LEFT JOIN Payments p
                ON o.OrderID = p.OrderID

            ORDER BY o.OrderID DESC
        `);

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_LIST_VIEW",

            description: `${currentUser.userType} viewed orders list`,

            status: "SUCCESS",

            newValues: {
                totalOrders: result.recordset.length
            }
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET ORDERS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_LIST_FAILED",

            description: `${currentUser.userType} failed to load orders list`,

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: err.message
        });
    }
});

// =========================
// ORDER DETAILS
// =========================
router.get("/:id/details", async (req, res) => {

    const currentUser = getCurrentUser(req);

    try {

        const pool = await poolPromise;

        const orderId = req.params.id;

        // =========================
        // ORDER
        // =========================
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

                LEFT JOIN Customers c
                    ON o.CustomerID = c.CustomerID

                WHERE o.OrderID = @OrderID
            `);

        // =========================
        // ITEMS
        // =========================
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

                LEFT JOIN Products p
                    ON oi.ProductID = p.ProductID

                WHERE oi.OrderID = @OrderID
            `);

        // =========================
        // PAYMENT
        // =========================
        const paymentResult = await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                SELECT *
                FROM Payments
                WHERE OrderID = @OrderID
            `);

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_DETAILS_VIEW",

            description:
                `${currentUser.userType} viewed order details (OrderID=${orderId})`,

            status: "SUCCESS",

            newValues: {
                orderId
            }
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

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_DETAILS_FAILED",

            description:
                `${currentUser.userType} failed to load order details (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                orderId: req.params.id,
                error: err.message
            }
        });

        res.status(500).json({
            message: err.message
        });
    }
});

// =========================
// UPDATE STATUS + ADMIN REMARKS (HISTORY)
// =========================
router.put("/:id/status", async (req, res) => {

    const currentUser = getCurrentUser(req);

    try {

        const allowed = [
            "Pending",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ];

        const { status, adminRemarks } = req.body;

        // =========================
        // INVALID STATUS
        // =========================
        if (!allowed.includes(status)) {

            await logAudit({

                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Orders",
                actionType: "ORDER_STATUS_INVALID",

                description:
                    `${currentUser.userType} attempted invalid order status update`,

                status: "FAILED",

                newValues: {
                    orderId: req.params.id,
                    attemptedStatus: status
                }
            });

            return res.status(400).json({
                message: "Invalid status"
            });
        }

        const pool = await poolPromise;

        // =========================
        // GET OLD ORDER DATA
        // =========================
        const oldOrderResult = await pool.request()

            .input("OrderID", sql.Int, req.params.id)

            .query(`
                SELECT
                    Status,
                    AdminRemarks
                FROM Orders
                WHERE OrderID = @OrderID
            `);

        const oldOrder =
            oldOrderResult.recordset[0] || {};

        // =========================
        // UPDATE STATUS
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
        // UPDATE ADMIN REMARKS
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
            // INSERT REMARK HISTORY
            // =========================
            await pool.request()

                .input("OrderID", sql.Int, req.params.id)
                .input("Status", sql.NVarChar, status)
                .input("Remarks", sql.NVarChar, adminRemarks)

                .input(
                    "CreatedBy",
                    sql.NVarChar,
                    currentUser.userName
                )

                .query(`
                    INSERT INTO OrderRemarksHistory
                    (
                        OrderID,
                        Status,
                        Remarks,
                        CreatedBy,
                        CreatedAt
                    )
                    VALUES
                    (
                        @OrderID,
                        @Status,
                        @Remarks,
                        @CreatedBy,
                        GETDATE()
                    )
                `);
        }

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_STATUS_UPDATED",

            description:
                `${currentUser.userType} updated order status to ${status} (OrderID=${req.params.id})`,

            status: "SUCCESS",

            oldValues: {
                oldStatus: oldOrder.Status,
                oldAdminRemarks: oldOrder.AdminRemarks
            },

            newValues: {
                orderId: req.params.id,
                newStatus: status,
                newAdminRemarks: adminRemarks || null
            }
        });

        res.json({
            message: "Order updated successfully"
        });

    } catch (err) {

        console.error("ORDER STATUS UPDATE ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_STATUS_UPDATE_FAILED",

            description:
                `${currentUser.userType} failed to update order status (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                orderId: req.params.id,
                error: err.message
            }
        });

        res.status(500).json({
            message: err.message
        });
    }
});

// =========================
// REMARKS HISTORY
// =========================
router.get("/:id/remarks", async (req, res) => {

    const currentUser = getCurrentUser(req);

    try {

        const pool = await poolPromise;

        const orderId = req.params.id;

        const result = await pool.request()

            .input("OrderID", sql.Int, orderId)

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

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_REMARKS_VIEW",

            description:
                `${currentUser.userType} viewed order remarks history (OrderID=${orderId})`,

            status: "SUCCESS",

            newValues: {
                orderId,
                totalRemarks: result.recordset.length
            }
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("ORDER REMARKS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_REMARKS_FAILED",

            description:
                `${currentUser.userType} failed to load order remarks history (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                orderId: req.params.id,
                error: err.message
            }
        });

        res.status(500).json({
            message: err.message
        });
    }
});

// =========================
// DELETE ORDER
// =========================
router.delete("/:id", async (req, res) => {

    const currentUser = getCurrentUser(req);

    try {

        const pool = await poolPromise;

        const orderId = req.params.id;

        // =========================
        // CHECK ORDER
        // =========================
        const check = await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                SELECT
                    o.OrderID,
                    o.CustomerID,
                    o.TotalAmount,
                    o.Status,
                    o.CreatedAt,

                    p.PaymentStatus,
                    p.PaymentMethod

                FROM Orders o

                LEFT JOIN Payments p
                    ON o.OrderID = p.OrderID

                WHERE o.OrderID = @OrderID
            `);

        const order = check.recordset[0];

        // =========================
        // ORDER NOT FOUND
        // =========================
        if (!order) {

            await logAudit({

                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Orders",
                actionType: "ORDER_DELETE_NOT_FOUND",

                description:
                    `${currentUser.userType} attempted to delete non-existing order (OrderID=${orderId})`,

                status: "FAILED",

                newValues: {
                    orderId
                }
            });

            return res.status(404).json({
                message: "Order not found"
            });
        }

        // =========================
        // DELETE RULE BLOCK
        // =========================
        if (
            !(
                order.Status === "Cancelled" &&
                (order.PaymentStatus || "").toLowerCase() === "failed"
            )
        ) {

            await logAudit({

                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Orders",
                actionType: "ORDER_DELETE_BLOCKED",

                description:
                    `${currentUser.userType} attempted blocked order deletion (OrderID=${orderId})`,

                status: "FAILED",

                oldValues: {
                    currentStatus: order.Status,
                    paymentStatus: order.PaymentStatus
                },

                newValues: {
                    orderId
                }
            });

            return res.status(400).json({
                message:
                    "Only cancelled + failed orders can be deleted"
            });
        }

        // =========================
        // DELETE ORDER ITEMS
        // =========================
        await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                DELETE FROM OrderItems
                WHERE OrderID = @OrderID
            `);

        // =========================
        // DELETE PAYMENTS
        // =========================
        await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                DELETE FROM Payments
                WHERE OrderID = @OrderID
            `);

        // =========================
        // DELETE REMARK HISTORY
        // =========================
        await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                DELETE FROM OrderRemarksHistory
                WHERE OrderID = @OrderID
            `);

        // =========================
        // DELETE ORDER
        // =========================
        await pool.request()

            .input("OrderID", sql.Int, orderId)

            .query(`
                DELETE FROM Orders
                WHERE OrderID = @OrderID
            `);

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_DELETED",

            description:
                `${currentUser.userType} deleted order successfully (OrderID=${orderId})`,

            status: "SUCCESS",

            oldValues: {
                orderId: order.OrderID,
                customerId: order.CustomerID,
                totalAmount: order.TotalAmount,
                status: order.Status,
                paymentStatus: order.PaymentStatus,
                paymentMethod: order.PaymentMethod,
                createdAt: order.CreatedAt
            }
        });

        res.json({
            message: "Order deleted successfully"
        });

    } catch (err) {

        console.error("ORDER DELETE ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({

            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Orders",
            actionType: "ORDER_DELETE_FAILED",

            description:
                `${currentUser.userType} failed to delete order (OrderID=${req.params.id})`,

            status: "FAILED",

            newValues: {
                orderId: req.params.id,
                error: err.message
            }
        });

        res.status(500).json({
            message: err.message
        });
    }
});

// =========================
// CREATE FULL ORDER
// =========================
router.post("/full-create", async (req, res) => {

    let orderId = null;

    const currentUser = getCurrentUser(req);

    try {

        // =========================
        // UNAUTHORIZED
        // =========================
        if (!currentUser || !currentUser.userId) {

            await logAudit({
                req,

                userId: null,
                userName: "Unknown",
                userType: "Customer",

                module: "Order",
                actionType: "ORDER_CREATE_UNAUTHORIZED",

                description: "Order creation blocked - no auth token",

                status: "FAILED"
            });

            return res.status(401).json({
                success: false
            });
        }

        const customerId = currentUser.userId;

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
                isCOD
                    ? "Pending"
                    : (PaymentStatus || "Success");

            const transactionId =
                isCOD
                    ? null
                    : "TXN" + Date.now();

            const vatPercent =
                VAT?.percent || 0;

            const vatAmount =
                VAT?.amount || 0;

            const addPercent =
                AdditionalCharges?.percent || 0;

            const addAmount =
                AdditionalCharges?.amount || 0;

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

            orderId =
                orderResult.recordset[0].OrderID;

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

            // =========================
            // AUDIT SUCCESS
            // =========================
            await logAudit({
                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

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
                    paymentStatus: finalPaymentStatus,
                    totalItems: Items?.length || 0
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

            // =========================
            // AUDIT FAILED
            // =========================
            await logAudit({
                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Order",
                actionType: "ORDER_CREATE_FAILED",

                description: "Order creation failed during transaction",

                status: "FAILED",

                newValues: {
                    orderId,
                    error: err.message
                }
            });

            throw err;
        }

    } catch (err) {

        console.error("ORDER CREATE ERROR:", err);

        // =========================
        // AUDIT ERROR
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Customer",

            module: "Order",
            actionType: "ORDER_CREATE_ERROR",

            description: "Order creation failed (outer catch)",

            status: "FAILED",

            newValues: {
                orderId,
                error: err.message
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

    const currentUser = getCurrentUser(req);

    try {

        // =========================
        // UNAUTHORIZED
        // =========================
        if (!currentUser || !currentUser.userId) {

            await logAudit({
                req,

                userId: null,
                userName: "Unknown",
                userType: "Customer",

                module: "Order",
                actionType: "MY_ORDERS_UNAUTHORIZED",

                description: "My orders access blocked - missing token",

                status: "FAILED"
            });

            return res.status(401).json([]);
        }

        const pool = await poolPromise;

        const result = await pool.request()

            .input(
                "CustomerID",
                sql.Int,
                currentUser.userId
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

        // =========================
        // AUDIT SUCCESS
        // =========================
        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Order",
            actionType: "MY_ORDERS_VIEW",

            description: "Customer viewed their orders list",

            status: "SUCCESS",

            newValues: {
                customerId: currentUser.userId,
                totalOrdersFetched: result.recordset.length
            }
        });

        res.json(result.recordset);

    } catch (err) {

        console.log("MY ORDERS ERROR:", err);

        // =========================
        // AUDIT FAILED
        // =========================
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.userName || "Unknown",
            userType: currentUser?.userType || "Customer",

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