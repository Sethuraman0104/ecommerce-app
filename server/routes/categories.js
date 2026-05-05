const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');

// GET ALL
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .query(`SELECT * FROM Categories ORDER BY Name`);

        res.json(result.recordset);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ADD CATEGORY (CASE-INSENSITIVE SAFE)
router.post('/', async (req, res) => {
    try {
        let { name } = req.body;
        name = name?.trim();

        if (!name) {
            return res.status(400).json({ message: "Category name required" });
        }

        const pool = await poolPromise;

        const exists = await pool.request()
            .input('Name', name)
            .query(`
                SELECT 1 FROM Categories 
                WHERE LOWER(Name) = LOWER(@Name)
            `);

        if (exists.recordset.length > 0) {
            return res.status(400).json({ message: "Category already exists" });
        }

        await pool.request()
            .input('Name', name)
            .query(`INSERT INTO Categories (Name) VALUES (@Name)`);

        res.json({ message: "Category added" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// =========================
// DELETE CATEGORY (SAFE CHECK)
// =========================
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const pool = await poolPromise;

        // 1. Check if category is used in PRODUCTS
        const usedInProducts = await pool.request()
            .input('CategoryID', id)
            .query(`
                SELECT TOP 1 1 
                FROM Products 
                WHERE CategoryID = @CategoryID
            `);

        if (usedInProducts.recordset.length > 0) {
            return res.status(400).json({
                message: "Cannot delete category. Products are assigned to it."
            });
        }

        // 2. Check if used in ORDERS (through OrderItems)
        const usedInOrders = await pool.request()
            .input('CategoryID', id)
            .query(`
                SELECT TOP 1 1 
                FROM OrderItems oi
                INNER JOIN Products p ON oi.ProductID = p.ProductID
                WHERE p.CategoryID = @CategoryID
            `);

        if (usedInOrders.recordset.length > 0) {
            return res.status(400).json({
                message: "Cannot delete category. Orders exist for products in this category."
            });
        }

        // 3. Safe delete
        await pool.request()
            .input('CategoryID', id)
            .query(`
                DELETE FROM Categories 
                WHERE CategoryID = @CategoryID
            `);

        res.json({ message: "Category deleted successfully" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;