const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');


// ==========================
// HELPER: OFFER VALIDATION
// ==========================
function normalizeOffer(hasOffer, offerStart, offerEnd) {

    const now = new Date();

    // If no offer
    if (!hasOffer) {
        return {
            hasOffer: 0,
            offerType: null,
            offerValue: null,
            offerStart: null,
            offerEnd: null,
            offerActive: 0
        };
    }

    const start = offerStart ? new Date(offerStart) : null;
    const end = offerEnd ? new Date(offerEnd) : null;

    // Invalid dates → disable offer
    if (!start || !end || start > end) {
        return {
            hasOffer: 0,
            offerType: null,
            offerValue: null,
            offerStart: null,
            offerEnd: null,
            offerActive: 0
        };
    }

    // Expired check
    const active = (start <= now && end >= now) ? 1 : 0;

    return {
        hasOffer: hasOffer ? 1 : 0,
        offerStart,
        offerEnd,
        offerActive: active
    };
}


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

                p.HasOffer,
                p.OfferType,
                p.OfferValue,
                p.OfferStart,
                p.OfferEnd,

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

            return {
                ...p,
                Image: image
            };
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

        let {
            name,
            description,
            price,
            stock,
            category,
            barcode,
            unitType,
            isActive,

            hasOffer,
            offerType,
            offerValue,
            offerStart,
            offerEnd,

            imageBase64,
            mimeType
        } = req.body;

        const pool = await poolPromise;

        // ==========================
        // OFFER NORMALIZATION (SAFE)
        // ==========================
        const offer = normalizeOffer(
            hasOffer,
            offerStart,
            offerEnd
        );

        const result = await pool.request()
            .input('Name', name)
            .input('Description', description)
            .input('Price', price)
            .input('Stock', stock)
            .input('CategoryID', category)
            .input('Barcode', barcode)
            .input('IsActive', isActive ?? 1)
            .input('UnitType', unitType)

            .input('HasOffer', offer.hasOffer)
            .input('OfferType', offer.hasOffer ? offerType : null)
            .input('OfferValue', offer.hasOffer ? offerValue : null)
            .input('OfferStart', offer.offerStart)
            .input('OfferEnd', offer.offerEnd)

            .query(`
                INSERT INTO Products (
                    Name,
                    Description,
                    Price,
                    Stock,
                    CategoryID,
                    Barcode,
                    IsActive,
                    UnitType,

                    HasOffer,
                    OfferType,
                    OfferValue,
                    OfferStart,
                    OfferEnd
                )

                OUTPUT INSERTED.ProductID

                VALUES (
                    @Name,
                    @Description,
                    @Price,
                    @Stock,
                    @CategoryID,
                    @Barcode,
                    @IsActive,
                    @UnitType,

                    @HasOffer,
                    @OfferType,
                    @OfferValue,
                    @OfferStart,
                    @OfferEnd
                )
            `);

        const productId = result.recordset[0].ProductID;

        // ==========================
        // IMAGE SAVE
        // ==========================
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
// UPDATE PRODUCT
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
            unitType,
            hasOffer,
            offerType,
            offerValue,
            offerStart,
            offerEnd,
            isActive,
            imageBase64,
            mimeType
        } = req.body;

        const pool = await poolPromise;

        // ==========================
        // OFFER SAFE UPDATE
        // ==========================
        const offer = normalizeOffer(
            hasOffer,
            offerStart,
            offerEnd
        );

        await pool.request()
            .input('ProductID', id)
            .input('Name', name)
            .input('Description', description)
            .input('Price', price)
            .input('Stock', stock)
            .input('CategoryID', category)
            .input('Barcode', barcode)
            .input('UnitType', unitType)

            .input('HasOffer', offer.hasOffer)
            .input('OfferType', offer.hasOffer ? offerType : null)
            .input('OfferValue', offer.hasOffer ? offerValue : null)
            .input('OfferStart', offer.offerStart)
            .input('OfferEnd', offer.offerEnd)

            .input('IsActive', isActive)

            .query(`
                UPDATE Products
                SET Name = COALESCE(@Name, Name),
                    Description = COALESCE(@Description, Description),
                    Price = COALESCE(@Price, Price),
                    Stock = COALESCE(@Stock, Stock),
                    CategoryID = COALESCE(@CategoryID, CategoryID),
                    Barcode = COALESCE(@Barcode, Barcode),
                    UnitType = COALESCE(@UnitType, UnitType),

                    HasOffer = @HasOffer,
                    OfferType = @OfferType,
                    OfferValue = @OfferValue,
                    OfferStart = @OfferStart,
                    OfferEnd = @OfferEnd,

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