const express = require("express");
const router = express.Router();

const { poolPromise } = require("../config/db");
const sql = require("mssql");

const logAudit = require("../utils/auditLogger");
const getCurrentUser = require("../utils/getCurrentUser");

/* =================================================
   AUDIT USER RESOLVER (GLOBAL SAFE)
================================================= */
function resolveAuditUser(req, fallback = {}) {

    const user = getCurrentUser(req);

    return {
        userId: user.userId || fallback.userId || null,
        userName: user.userName || fallback.userName || "Guest",
        userType: user.userType || fallback.userType || "Guest"
    };
}

/* =================================================
   GET ALL COUPONS
================================================= */
router.get("/", async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT *
            FROM Coupons
            ORDER BY CouponID DESC
        `);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_LIST",

            description: "Viewed coupons list",

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET COUPONS ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_LIST_FAILED",

            description: "Failed to load coupons list",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: "Server error"
        });
    }
});

/* =================================================
   CREATE / UPDATE COUPON
================================================= */
router.post("/", async (req, res) => {

    try {

        const { id, code, discount, expiry } = req.body;

        const pool = await poolPromise;

        if (!code || !discount || !expiry) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "Coupon",
                actionType: "COUPON_SAVE_FAILED",

                description: "Missing required fields",

                status: "FAILED",

                newValues: { code, discount, expiry }
            });

            return res.status(400).json({
                message: "All fields are required"
            });
        }

        /* =================================================
           UPDATE COUPON
        ================================================= */
        if (id) {

            const oldRes = await pool.request()
                .input("id", sql.Int, id)
                .query(`
                    SELECT *
                    FROM Coupons
                    WHERE CouponID=@id
                `);

            if (!oldRes.recordset.length) {

                await logAudit({
                    req,
                    ...resolveAuditUser(req),

                    module: "Coupon",
                    actionType: "COUPON_UPDATE_FAILED",

                    description: `Coupon not found ID=${id}`,

                    status: "FAILED"
                });

                return res.status(404).json({
                    message: "Coupon not found"
                });
            }

            const old = oldRes.recordset[0];

            await pool.request()
                .input("id", sql.Int, id)
                .input("code", sql.NVarChar, code)
                .input("discount", sql.Int, discount)
                .input("expiry", sql.DateTime, expiry)
                .query(`
                    UPDATE Coupons
                    SET Code=@code,
                        DiscountPercent=@discount,
                        ExpiryDate=@expiry
                    WHERE CouponID=@id
                `);

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "Coupon",
                actionType: "COUPON_UPDATED",

                description: `Updated coupon "${old.Code}"`,

                oldValues: old,
                newValues: { code, discount, expiry },

                status: "SUCCESS"
            });
        }

        /* =================================================
           CREATE COUPON
        ================================================= */
        else {

            const exists = await pool.request()
                .input("code", sql.NVarChar, code)
                .query(`
                    SELECT TOP 1 *
                    FROM Coupons
                    WHERE LOWER(Code)=LOWER(@code)
                `);

            if (exists.recordset.length) {

                await logAudit({
                    req,
                    ...resolveAuditUser(req),

                    module: "Coupon",
                    actionType: "COUPON_DUPLICATE",

                    description: `Duplicate coupon: ${code}`,

                    status: "FAILED"
                });

                return res.status(400).json({
                    message: "Coupon already exists"
                });
            }

            await pool.request()
                .input("code", sql.NVarChar, code)
                .input("discount", sql.Int, discount)
                .input("expiry", sql.DateTime, expiry)
                .query(`
                    INSERT INTO Coupons
                    (Code, DiscountPercent, ExpiryDate)
                    VALUES (@code, @discount, @expiry)
                `);

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "Coupon",
                actionType: "COUPON_CREATED",

                description: `Created coupon "${code}"`,

                newValues: { code, discount, expiry },

                status: "SUCCESS"
            });
        }

        res.json({
            success: true,
            message: "Coupon saved successfully"
        });

    } catch (err) {

        console.error("SAVE COUPON ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_SAVE_FAILED",

            description: "Coupon save operation failed",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: "Server error"
        });
    }
});

/* =================================================
   TOGGLE COUPON STATUS
================================================= */
router.put("/:id/toggle", async (req, res) => {

    try {

        const pool = await poolPromise;

        const couponRes = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM Coupons
                WHERE CouponID=@id
            `);

        if (!couponRes.recordset.length) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "Coupon",
                actionType: "COUPON_TOGGLE_FAILED",

                description: `Coupon not found ID=${req.params.id}`,

                status: "FAILED"
            });

            return res.status(404).json({
                message: "Coupon not found"
            });
        }

        const coupon = couponRes.recordset[0];

        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                UPDATE Coupons
                SET IsActive =
                    CASE WHEN IsActive = 1 THEN 0 ELSE 1 END
                WHERE CouponID=@id
            `);

        const newStatus = coupon.IsActive ? "Inactive" : "Active";

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_STATUS_CHANGED",

            description: `Coupon "${coupon.Code}" changed to ${newStatus}`,

            oldValues: { isActive: coupon.IsActive },
            newValues: { isActive: coupon.IsActive ? 0 : 1 },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Coupon status updated"
        });

    } catch (err) {

        console.error("TOGGLE ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_TOGGLE_FAILED",

            description: "Coupon toggle failed",

            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({
            message: "Server error"
        });
    }
});

/* =================================================
   DELETE COUPON
================================================= */
router.delete("/:id", async (req, res) => {

    try {

        const pool = await poolPromise;

        const couponRes = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM Coupons
                WHERE CouponID=@id
            `);

        if (!couponRes.recordset.length) {

            await logAudit({
                req,
                ...resolveAuditUser(req),

                module: "Coupon",
                actionType: "COUPON_DELETE_FAILED",

                description: `Coupon not found ID=${req.params.id}`,

                status: "FAILED"
            });

            return res.status(404).json({
                message: "Coupon not found"
            });
        }

        const coupon = couponRes.recordset[0];

        await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
                DELETE FROM Coupons
                WHERE CouponID=@id
            `);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_DELETED",

            description: `Deleted coupon "${coupon.Code}"`,

            oldValues: coupon,

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Coupon deleted successfully"
        });

    } catch (err) {

        console.error("DELETE ERROR:", err);

        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_DELETE_FAILED",

            description: "Coupon deletion failed",

            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({
            message: "Server error"
        });
    }
});

/* =================================================
   COUPON USAGE REPORT
================================================= */
router.get("/:id/usage", async (req, res) => {

    try {

        const pool = await poolPromise;

        // GET COUPON INFO
        const couponRes = await pool.request()
            .input("CouponID", sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM Coupons
                WHERE CouponID=@CouponID
            `);

        const coupon = couponRes.recordset[0];

        // GET USAGE DATA
        const result = await pool.request()
            .input("CouponID", sql.Int, req.params.id)
            .query(`
                SELECT 
                    o.OrderID,
                    o.TotalAmount,
                    o.Status,
                    o.CreatedAt,

                    o.SubTotal,
                    o.DiscountAmount,
                    o.VATPercent,
                    o.VATAmount,
                    o.AdditionalPercent,
                    o.AdditionalAmount,

                    c.FullName,
                    c.Email,

                    p.PaymentStatus,
                    p.PaymentMethod,
                    p.TransactionID,
                    p.PaidAt,

                    Items.Items

                FROM Orders o

                LEFT JOIN Customers c
                    ON o.CustomerID = c.CustomerID

                LEFT JOIN Payments p
                    ON o.OrderID = p.OrderID

                OUTER APPLY (
                    SELECT (
                        SELECT 
                            oi.ProductID,
                            pr.Name AS ProductName,
                            oi.Quantity,
                            oi.Price,
                            (oi.Quantity * oi.Price) AS LineTotal
                        FROM OrderItems oi

                        LEFT JOIN Products pr
                            ON pr.ProductID = oi.ProductID

                        WHERE oi.OrderID = o.OrderID

                        FOR JSON PATH
                    ) AS Items
                ) Items

                WHERE o.CouponID = @CouponID
                ORDER BY o.CreatedAt DESC
            `);

        const data = result.recordset.map(r => ({
            ...r,
            Items: r.Items ? JSON.parse(r.Items) : []
        }));

        /* =================================================
           AUDIT SUCCESS
        ================================================= */
        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_USAGE_VIEW",

            description: `Viewed usage report for coupon "${coupon?.Code || req.params.id}"`,

            status: "SUCCESS"
        });

        res.json(data);

    } catch (err) {

        console.error("COUPON USAGE ERROR:", err);

        /* =================================================
           AUDIT FAILURE
        ================================================= */
        await logAudit({
            req,
            ...resolveAuditUser(req),

            module: "Coupon",
            actionType: "COUPON_USAGE_VIEW_FAILED",

            description: "Failed to load coupon usage report",

            status: "FAILED",

            newValues: {
                couponId: req.params.id,
                error: err.message
            }
        });

        res.status(500).json({
            message: "Server error"
        });
    }
});

module.exports = router;