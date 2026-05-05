const express = require("express");
const router = express.Router();
const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ================= GET
router.get("/", async (req, res) => {

    const pool = await poolPromise;

    const result = await pool.request().query(`
        SELECT * FROM Coupons ORDER BY CouponID DESC
    `);

    res.json(result.recordset);
});

// ================= CREATE / UPDATE
router.post("/", async (req, res) => {

    const { id, code, discount, expiry } = req.body;

    const pool = await poolPromise;

    if (id) {
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
    } else {
        await pool.request()
            .input("code", sql.NVarChar, code)
            .input("discount", sql.Int, discount)
            .input("expiry", sql.DateTime, expiry)
            .query(`
                INSERT INTO Coupons (Code, DiscountPercent, ExpiryDate)
                VALUES (@code, @discount, @expiry)
            `);
    }

    res.json({ message: "Saved" });
});

// ================= TOGGLE
router.put("/:id/toggle", async (req, res) => {

    const pool = await poolPromise;

    await pool.request()
        .input("id", sql.Int, req.params.id)
        .query(`
            UPDATE Coupons
            SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END
            WHERE CouponID=@id
        `);

    res.json({ message: "Updated" });
});

// ================= DELETE
router.delete("/:id", async (req, res) => {

    const pool = await poolPromise;

    await pool.request()
        .input("id", sql.Int, req.params.id)
        .query(`DELETE FROM Coupons WHERE CouponID=@id`);

    res.json({ message: "Deleted" });
});

// ================= COUPON USAGE (ORDERS + PAYMENTS)
router.get("/:id/usage", async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input("CouponID", sql.Int, req.params.id)
            .query(`

                SELECT 
                    o.OrderID,
                    o.TotalAmount,
                    o.Status,
                    o.CreatedAt,
                    o.CustomerRemarks,
                    o.AdminRemarks,
                    o.DiscountAmount,

                    c.FullName,
                    c.Email,

                    p.PaymentStatus,
                    p.PaymentMethod,
                    p.TransactionID,

                    (
                        SELECT 
                            oi.ProductID,
                            oi.Quantity,
                            oi.Price
                        FROM OrderItems oi
                        WHERE oi.OrderID = o.OrderID
                        FOR JSON PATH
                    ) AS Items

                FROM Orders o
                LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
                LEFT JOIN Payments p ON o.OrderID = p.OrderID

                WHERE o.CouponID = @CouponID

                ORDER BY o.CreatedAt DESC
            `);

        const data = result.recordset.map(r => ({
            ...r,
            Items: r.Items ? JSON.parse(r.Items) : []
        }));

        res.json(data);

    } catch (err) {
        console.error("COUPON USAGE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;