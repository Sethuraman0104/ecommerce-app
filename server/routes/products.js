const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');


// ==========================
// GET PRODUCTS
// ==========================
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                p.ProductID,
                p.Name,
                p.Description,
                p.UnitType,
                p.Price,
                p.Stock,
                p.Barcode,
                p.CategoryID,
                p.IsActive,
                c.Name AS Category,
                pi.ImageData,
                pi.MimeType,

                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM OrderItems oi 
                        WHERE oi.ProductID = p.ProductID
                    )
                    THEN 1 ELSE 0
                END AS HasOrders

            FROM Products p
            LEFT JOIN Categories c ON p.CategoryID = c.CategoryID
            LEFT JOIN ProductImages pi ON p.ProductID = pi.ProductID
            ORDER BY p.CreatedAt DESC
        `);

        const products = result.recordset.map(p => {
            let image = null;

            if (p.ImageData) {
                image = `data:${p.MimeType};base64,${Buffer.from(p.ImageData).toString('base64')}`;
            }

            return { ...p, Image: image };
        });

        res.json(products);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================
// ADD PRODUCT
// ==========================
router.post('/', async (req, res) => {
    try {
        let { name, description, price, stock, category, barcode, unitType, isActive, imageBase64, mimeType } = req.body;

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Name', name)
            .input('Description', description)
            .input('Price', price)
            .input('Stock', stock)
            .input('CategoryID', category)
            .input('Barcode', barcode)
            .input('IsActive', isActive ?? 1)
            .input('UnitType', unitType)
            .query(`
                INSERT INTO Products (Name, Description, Price, Stock, CategoryID, Barcode, IsActive, UnitType)
OUTPUT INSERTED.ProductID
VALUES (@Name, @Description, @Price, @Stock, @CategoryID, @Barcode, @IsActive, @UnitType)
            `);

        const productId = result.recordset[0].ProductID;

        if (imageBase64) {
            const buffer = Buffer.from(imageBase64, 'base64');

            await pool.request()
                .input('ProductID', productId)
                .input('ImageData', buffer)
                .input('MimeType', mimeType)
                .query(`
                    INSERT INTO ProductImages (ProductID, ImageData, MimeType)
                    VALUES (@ProductID, @ImageData, @MimeType)
                `);
        }

        res.json({ message: "Product added" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ==========================
// UPDATE PRODUCT (SMART UPDATE)
// ==========================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            description,
            price,
            stock,
            category,
            barcode,
            unitType,   // ✅ FIX 1: extract from body
            isActive,
            imageBase64,
            mimeType
        } = req.body;

        const pool = await poolPromise;

        await pool.request()
            .input('ProductID', id)
            .input('Name', name)
            .input('Description', description)
            .input('Price', price)
            .input('Stock', stock)
            .input('CategoryID', category)
            .input('Barcode', barcode)
            .input('UnitType', unitType)   // ✅ FIX 2: pass param
            .input('IsActive', isActive)
            .query(`
                UPDATE Products
                SET Name = COALESCE(@Name, Name),
                    Description = COALESCE(@Description, Description),
                    Price = COALESCE(@Price, Price),
                    Stock = COALESCE(@Stock, Stock),
                    CategoryID = COALESCE(@CategoryID, CategoryID),
                    Barcode = COALESCE(@Barcode, Barcode),
                    UnitType = COALESCE(@UnitType, UnitType), -- ✅ FIX 3
                    IsActive = COALESCE(@IsActive, IsActive)
                WHERE ProductID = @ProductID
            `);

        // ==========================
        // IMAGE UPDATE
        // ==========================
        if (imageBase64) {

            const buffer = Buffer.from(imageBase64, 'base64');

            await pool.request()
                .input('ProductID', id)
                .query(`DELETE FROM ProductImages WHERE ProductID=@ProductID`);

            await pool.request()
                .input('ProductID', id)
                .input('ImageData', buffer)
                .input('MimeType', mimeType)
                .query(`
                    INSERT INTO ProductImages (ProductID, ImageData, MimeType)
                    VALUES (@ProductID, @ImageData, @MimeType)
                `);
        }

        res.json({ message: "Updated" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});


// ==========================
// DELETE
// ==========================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        await pool.request()
            .input('ProductID', id)
            .query(`DELETE FROM ProductImages WHERE ProductID=@ProductID`);

        await pool.request()
            .input('ProductID', id)
            .query(`DELETE FROM Products WHERE ProductID=@ProductID`);

        res.json({ message: "Deleted" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;