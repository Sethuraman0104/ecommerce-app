const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');
const sql = require('mssql');

const logAudit = require('../utils/auditLogger');
const getCurrentUser = require('../utils/getCurrentUser');

/* =========================
   HELPER: OFFER VALIDATION
========================= */
function normalizeOffer(hasOffer, offerStart, offerEnd) {

    const now = new Date();

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

    const active = (start <= now && end >= now) ? 1 : 0;

    return {
        hasOffer: hasOffer ? 1 : 0,
        offerStart,
        offerEnd,
        offerActive: active
    };
}

/* =========================
   GET PRODUCTS
========================= */
router.get('/', async (req, res) => {

    const loggedInUser = getCurrentUser(req);

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

            return { ...p, Image: image };
        });

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_LIST_VIEW",
            description: "Viewed product list",
            status: "SUCCESS"
        });

        res.json(products);

    } catch (err) {

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_LIST_FAILED",
            description: "Failed to load product list",
            status: "FAILED",
            newValues: { error: err.message }
        });

        res.status(500).json({ message: err.message });
    }
});

/* =========================
   ADD PRODUCT (FIXED AUDIT)
========================= */
router.post('/', async (req, res) => {

    const loggedInUser = getCurrentUser(req);

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

        const offer = normalizeOffer(hasOffer, offerStart, offerEnd);

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

        /* =========================
           FIXED AUDIT (ADD PRODUCT)
        ========================= */
        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_CREATED",
            description: `Product created: ${name}`,

            status: "SUCCESS",

            newValues: {
                ProductID: productId,
                Name: name,
                Description: description,
                Price: price,
                Stock: stock,
                CategoryID: category,
                Barcode: barcode,
                UnitType: unitType,
                IsActive: isActive ?? 1,

                // ✅ IMPORTANT: offer captured properly
                HasOffer: offer.hasOffer,
                OfferType: offer.hasOffer ? offerType : null,
                OfferValue: offer.hasOffer ? offerValue : null,
                OfferStart: offer.offerStart,
                OfferEnd: offer.offerEnd
            }
        });

        res.json({ message: "Product added" });

    } catch (err) {

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_CREATE_FAILED",
            description: "Product creation failed",
            status: "FAILED",
            newValues: { error: err.message }
        });

        res.status(500).json({ message: err.message });
    }
});

/* =========================
   UPDATE PRODUCT (FIXED AUDIT)
========================= */
router.put('/:id', async (req, res) => {

    const loggedInUser = getCurrentUser(req);

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

        /* =========================
           OLD VALUES (BEFORE UPDATE)
        ========================= */
        const oldResult = await pool.request()
            .input('ProductID', sql.Int, id)
            .query(`
                SELECT 
                    ProductID,
                    Name,
                    Description,
                    Price,
                    Stock,
                    CategoryID,
                    Barcode,
                    UnitType,
                    HasOffer,
                    OfferType,
                    OfferValue,
                    OfferStart,
                    OfferEnd,
                    IsActive
                FROM Products
                WHERE ProductID = @ProductID
            `);

        const oldValues = oldResult.recordset[0];

        if (!oldValues) {
            return res.status(404).json({ message: "Product not found" });
        }

        /* =========================
           NORMALIZE OFFER
        ========================= */
        const offer = normalizeOffer(hasOffer, offerStart, offerEnd);

        /* =========================
           UPDATE PRODUCT
        ========================= */
        await pool.request()
            .input('ProductID', sql.Int, id)
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

        /* =========================
           IMAGE UPDATE
        ========================= */
        if (imageBase64) {

            const buffer = Buffer.from(imageBase64, 'base64');

            await pool.request()
                .input('ProductID', sql.Int, id)
                .query(`DELETE FROM ProductImages WHERE ProductID=@ProductID`);

            await pool.request()
                .input('ProductID', sql.Int, id)
                .input('ImageData', buffer)
                .input('MimeType', mimeType)
                .query(`
                    INSERT INTO ProductImages (ProductID, ImageData, MimeType)
                    VALUES (@ProductID, @ImageData, @MimeType)
                `);
        }

        /* =========================
           FIXED AUDIT (UPDATE PRODUCT)
        ========================= */
        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_UPDATED",
            description: `Product updated ID=${id}`,

            oldValues: oldValues,

            newValues: {
                ProductID: id,
                Name: name,
                Description: description,
                Price: price,
                Stock: stock,
                CategoryID: category,
                Barcode: barcode,
                UnitType: unitType,
                IsActive: isActive,

                // ✅ FIXED OFFER TRACKING
                HasOffer: offer.hasOffer,
                OfferType: offer.hasOffer ? offerType : null,
                OfferValue: offer.hasOffer ? offerValue : null,
                OfferStart: offer.offerStart,
                OfferEnd: offer.offerEnd
            },

            status: "SUCCESS"
        });

        res.json({ message: "Updated" });

    } catch (err) {

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_UPDATE_FAILED",
            description: "Product update failed",
            status: "FAILED",
            newValues: { error: err.message }
        });

        res.status(500).json({ message: err.message });
    }
});

/* =========================
   DELETE PRODUCT
========================= */
router.delete('/:id', async (req, res) => {

    const loggedInUser = getCurrentUser(req);

    try {

        const { id } = req.params;
        const pool = await poolPromise;

        await pool.request()
            .input('ProductID', id)
            .query(`DELETE FROM ProductImages WHERE ProductID=@ProductID`);

        await pool.request()
            .input('ProductID', id)
            .query(`DELETE FROM Products WHERE ProductID=@ProductID`);

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_DELETED",
            description: `Product deleted ID=${id}`,
            status: "SUCCESS",
            oldValues: { productId: id }
        });

        res.json({ message: "Deleted" });

    } catch (err) {

        await logAudit({
            req,
            userId: loggedInUser.userId,
            userName: loggedInUser.userName,
            userType: loggedInUser.userType,

            module: "Product",
            actionType: "PRODUCT_DELETE_FAILED",
            description: "Product deletion failed",
            status: "FAILED",
            newValues: { error: err.message }
        });

        res.status(500).json({ message: err.message });
    }
});

module.exports = router;