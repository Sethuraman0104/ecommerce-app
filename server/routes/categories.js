const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');

const { poolPromise } = require('../config/db');
const logAudit = require('../utils/auditLogger');

/* =================================================
   GET LOGGED-IN USER FROM JWT
================================================= */
function getLoggedInUser(req) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return null;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return null;
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        return {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };

    } catch (err) {

        return null;
    }
}

/* =================================================
   GET ALL CATEGORIES
================================================= */
router.get('/', async (req, res) => {

    const loggedInUser = getLoggedInUser(req);

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .query(`
                SELECT *
                FROM Categories
                ORDER BY Name
            `);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_LIST",

            description: "Viewed categories list",

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET CATEGORIES ERROR:", err);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_LIST_FAILED",

            description: "Failed loading categories",

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

/* =================================================
   ADD CATEGORY
================================================= */
router.post('/', async (req, res) => {

    const loggedInUser = getLoggedInUser(req);

    try {

        let { name } = req.body;

        name = name?.trim();

        if (!name) {

            await logAudit({
                req,

                userId: loggedInUser?.userId || null,
                userName: loggedInUser?.email || "Unknown",

                module: "Category",
                actionType: "CATEGORY_CREATE_FAILED",

                description: "Category name missing",

                status: "FAILED"
            });

            return res.status(400).json({
                message: "Category name required"
            });
        }

        const pool = await poolPromise;

        // DUPLICATE CHECK
        const exists = await pool.request()
            .input('Name', name)
            .query(`
                SELECT TOP 1 *
                FROM Categories
                WHERE LOWER(Name)=LOWER(@Name)
            `);

        if (exists.recordset.length > 0) {

            await logAudit({
                req,

                userId: loggedInUser?.userId || null,
                userName: loggedInUser?.email || "Unknown",

                module: "Category",
                actionType: "CATEGORY_DUPLICATE",

                description: `Duplicate category attempted: ${name}`,

                status: "FAILED",

                newValues: {
                    categoryName: name
                }
            });

            return res.status(400).json({
                message: "Category already exists"
            });
        }

        // INSERT
        await pool.request()
            .input('Name', name)
            .query(`
                INSERT INTO Categories (Name)
                VALUES (@Name)
            `);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_CREATED",

            description: `Created category "${name}"`,

            status: "SUCCESS",

            newValues: {
                categoryName: name
            }
        });

        res.json({
            success: true,
            message: "Category added successfully"
        });

    } catch (err) {

        console.error("CATEGORY CREATE ERROR:", err);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_CREATE_FAILED",

            description: "Category creation failed",

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

/* =================================================
   UPDATE CATEGORY
================================================= */
router.put('/:id', async (req, res) => {

    const loggedInUser = getLoggedInUser(req);

    try {

        const id = req.params.id;

        let { name } = req.body;

        name = name?.trim();

        if (!name) {

            return res.status(400).json({
                message: "Category name required"
            });
        }

        const pool = await poolPromise;

        // OLD CATEGORY
        const oldCategory = await pool.request()
            .input('CategoryID', id)
            .query(`
                SELECT *
                FROM Categories
                WHERE CategoryID=@CategoryID
            `);

        if (!oldCategory.recordset.length) {

            return res.status(404).json({
                message: "Category not found"
            });
        }

        const previous = oldCategory.recordset[0];

        // UPDATE
        await pool.request()
            .input('CategoryID', id)
            .input('Name', name)
            .query(`
                UPDATE Categories
                SET Name=@Name
                WHERE CategoryID=@CategoryID
            `);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_UPDATED",

            description:
                `Updated category from "${previous.Name}" to "${name}"`,

            oldValues: {
                categoryName: previous.Name
            },

            newValues: {
                categoryName: name
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Category updated successfully"
        });

    } catch (err) {

        console.error("CATEGORY UPDATE ERROR:", err);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_UPDATE_FAILED",

            description: "Category update failed",

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

/* =================================================
   DELETE CATEGORY
================================================= */
router.delete('/:id', async (req, res) => {

    const loggedInUser = getLoggedInUser(req);

    try {

        const id = req.params.id;

        const pool = await poolPromise;

        // GET CATEGORY
        const categoryRes = await pool.request()
            .input('CategoryID', id)
            .query(`
                SELECT *
                FROM Categories
                WHERE CategoryID=@CategoryID
            `);

        if (!categoryRes.recordset.length) {

            return res.status(404).json({
                message: "Category not found"
            });
        }

        const category = categoryRes.recordset[0];

        // DELETE
        await pool.request()
            .input('CategoryID', id)
            .query(`
                DELETE FROM Categories
                WHERE CategoryID=@CategoryID
            `);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_DELETED",

            description:
                `Deleted category "${category.Name}"`,

            oldValues: {
                categoryId: category.CategoryID,
                categoryName: category.Name
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (err) {

        console.error("CATEGORY DELETE ERROR:", err);

        await logAudit({
            req,

            userId: loggedInUser?.userId || null,
            userName: loggedInUser?.email || "Unknown",

            module: "Category",
            actionType: "CATEGORY_DELETE_FAILED",

            description: "Category deletion failed",

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

module.exports = router;