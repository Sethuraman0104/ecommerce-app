const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const sql = require('mssql');

const { poolPromise } = require('../config/db');
const logAudit = require('../utils/auditLogger');

/* =================================================
   GET USER FROM TOKEN
================================================= */
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

/* =================================================
   GET ALL CUSTOMERS
================================================= */
router.get('/', async (req, res) => {

    const currentUser = getUserFromToken(req);

    try {

        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                CustomerID,
                FullName,
                Email,
                Phone,
                AddressLine1,
                AddressLine2,
                City,
                State,
                Country,
                PostalCode,
                CreatedAt
            FROM Customers
            ORDER BY CustomerID DESC
        `);

        // AUDIT SUCCESS
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_LIST_VIEW",

            description: "Viewed customers list",

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET CUSTOMERS ERROR:", err);

        // AUDIT FAILED
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_LIST_FAILED",

            description: "Failed to load customers list",

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
   CREATE CUSTOMER
================================================= */
router.post('/', async (req, res) => {

    const currentUser = getUserFromToken(req);

    try {

        const {
            fullName,
            email,
            phone,
            city,
            state,
            country,
            postalCode,
            addressLine1,
            addressLine2
        } = req.body;

        if (!fullName?.trim()) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Customer",
                actionType: "CUSTOMER_CREATE_FAILED",

                description: "Customer creation failed - name missing",

                status: "FAILED"
            });

            return res.status(400).json({
                message: "Customer name required"
            });
        }

        const pool = await poolPromise;

        // CHECK DUPLICATE EMAIL
        if (email) {

            const exists = await pool.request()
                .input('Email', sql.NVarChar, email)
                .query(`
                    SELECT TOP 1 CustomerID
                    FROM Customers
                    WHERE Email=@Email
                `);

            if (exists.recordset.length > 0) {

                await logAudit({
                    req,

                    userId: currentUser?.userId || null,
                    userName: currentUser?.email || "Unknown",

                    module: "Customer",
                    actionType: "CUSTOMER_DUPLICATE",

                    description: `Duplicate customer attempted: ${email}`,

                    status: "FAILED",

                    newValues: {
                        email
                    }
                });

                return res.status(400).json({
                    message: "Customer email already exists"
                });
            }
        }

        // INSERT
        await pool.request()
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email || null)
            .input('Phone', sql.NVarChar, phone || null)
            .input('City', sql.NVarChar, city || null)
            .input('State', sql.NVarChar, state || null)
            .input('Country', sql.NVarChar, country || null)
            .input('PostalCode', sql.NVarChar, postalCode || null)
            .input('AddressLine1', sql.NVarChar, addressLine1 || null)
            .input('AddressLine2', sql.NVarChar, addressLine2 || null)
            .query(`
                INSERT INTO Customers
                (
                    FullName,
                    Email,
                    Phone,
                    City,
                    State,
                    Country,
                    PostalCode,
                    AddressLine1,
                    AddressLine2,
                    CreatedAt
                )
                VALUES
                (
                    @FullName,
                    @Email,
                    @Phone,
                    @City,
                    @State,
                    @Country,
                    @PostalCode,
                    @AddressLine1,
                    @AddressLine2,
                    GETDATE()
                )
            `);

        // AUDIT SUCCESS
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_CREATED",

            description: `Customer created: ${fullName}`,

            status: "SUCCESS",

            newValues: {
                fullName,
                email,
                phone,
                city,
                state,
                country
            }
        });

        res.json({
            success: true,
            message: "Customer added successfully"
        });

    } catch (err) {

        console.error("CREATE CUSTOMER ERROR:", err);

        // AUDIT FAILED
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_CREATE_FAILED",

            description: "Customer creation failed",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: "Insert failed",
            error: err.message
        });
    }
});

/* =================================================
   UPDATE CUSTOMER
================================================= */
router.put('/:id', async (req, res) => {

    const currentUser = getUserFromToken(req);

    try {

        const id = req.params.id;

        const {
            fullName,
            email,
            phone,
            city,
            state,
            country,
            postalCode,
            addressLine1,
            addressLine2
        } = req.body;

        const pool = await poolPromise;

        // GET OLD DATA
        const oldRes = await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                SELECT *
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        if (!oldRes.recordset.length) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Customer",
                actionType: "CUSTOMER_UPDATE_FAILED",

                description: `Customer not found ID=${id}`,

                status: "FAILED"
            });

            return res.status(404).json({
                message: "Customer not found"
            });
        }

        const oldCustomer = oldRes.recordset[0];

        // UPDATE
        await pool.request()
            .input('CustomerID', sql.Int, id)
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email || null)
            .input('Phone', sql.NVarChar, phone || null)
            .input('City', sql.NVarChar, city || null)
            .input('State', sql.NVarChar, state || null)
            .input('Country', sql.NVarChar, country || null)
            .input('PostalCode', sql.NVarChar, postalCode || null)
            .input('AddressLine1', sql.NVarChar, addressLine1 || null)
            .input('AddressLine2', sql.NVarChar, addressLine2 || null)
            .query(`
                UPDATE Customers SET
                    FullName = @FullName,
                    Email = @Email,
                    Phone = @Phone,
                    City = @City,
                    State = @State,
                    Country = @Country,
                    PostalCode = @PostalCode,
                    AddressLine1 = @AddressLine1,
                    AddressLine2 = @AddressLine2
                WHERE CustomerID = @CustomerID
            `);

        // AUDIT SUCCESS
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_UPDATED",

            description: `Customer updated: ${oldCustomer.FullName}`,

            oldValues: {
                fullName: oldCustomer.FullName,
                email: oldCustomer.Email,
                phone: oldCustomer.Phone,
                city: oldCustomer.City,
                country: oldCustomer.Country
            },

            newValues: {
                fullName,
                email,
                phone,
                city,
                country
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Customer updated successfully"
        });

    } catch (err) {

        console.error("UPDATE CUSTOMER ERROR:", err);

        // AUDIT FAILED
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_UPDATE_FAILED",

            description: "Customer update failed",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: "Update failed",
            error: err.message
        });
    }
});

/* =================================================
   DELETE CUSTOMER
================================================= */
router.delete('/:id', async (req, res) => {

    const currentUser = getUserFromToken(req);

    try {

        const id = req.params.id;

        const pool = await poolPromise;

        // GET CUSTOMER
        const customerRes = await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                SELECT *
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        if (!customerRes.recordset.length) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Customer",
                actionType: "CUSTOMER_DELETE_FAILED",

                description: `Customer not found ID=${id}`,

                status: "FAILED"
            });

            return res.status(404).json({
                message: "Customer not found"
            });
        }

        const customer = customerRes.recordset[0];

        // CHECK ORDERS
        const orderCheck = await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                SELECT TOP 1 OrderID
                FROM Orders
                WHERE CustomerID=@CustomerID
            `);

        if (orderCheck.recordset.length > 0) {

            await logAudit({
                req,

                userId: currentUser?.userId || null,
                userName: currentUser?.email || "Unknown",

                module: "Customer",
                actionType: "CUSTOMER_DELETE_BLOCKED",

                description:
                    `Delete blocked for customer ${customer.FullName} because orders exist`,

                status: "FAILED"
            });

            return res.status(400).json({
                message: "Cannot delete customer with existing orders"
            });
        }

        // DELETE
        await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                DELETE FROM Customers
                WHERE CustomerID = @CustomerID
            `);

        // AUDIT SUCCESS
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_DELETED",

            description: `Deleted customer ${customer.FullName}`,

            oldValues: {
                customerId: customer.CustomerID,
                fullName: customer.FullName,
                email: customer.Email
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });

    } catch (err) {

        console.error("DELETE CUSTOMER ERROR:", err);

        // AUDIT FAILED
        await logAudit({
            req,

            userId: currentUser?.userId || null,
            userName: currentUser?.email || "Unknown",

            module: "Customer",
            actionType: "CUSTOMER_DELETE_FAILED",

            description: "Customer deletion failed",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            message: "Delete failed",
            error: err.message
        });
    }
});

/* =================================================
   CUSTOMER SELF UPDATE
================================================= */
router.put('/update', async (req, res) => {

    try {

        const auth = req.headers.authorization;

        if (!auth) {

            return res.status(401).json({
                success: false
            });
        }

        const token = auth.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const {
            FullName,
            Email,
            Phone,
            AddressLine1,
            AddressLine2,
            City,
            State,
            Country,
            PostalCode
        } = req.body;

        const pool = await poolPromise;

        // OLD DATA
        const oldRes = await pool.request()
            .input("CustomerID", sql.Int, decoded.customerId)
            .query(`
                SELECT *
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        const oldData = oldRes.recordset[0];

        // UPDATE
        await pool.request()
            .input("CustomerID", sql.Int, decoded.customerId)
            .input("FullName", sql.NVarChar, FullName)
            .input("Email", sql.NVarChar, Email)
            .input("Phone", sql.NVarChar, Phone)
            .input("AddressLine1", sql.NVarChar, AddressLine1)
            .input("AddressLine2", sql.NVarChar, AddressLine2)
            .input("City", sql.NVarChar, City)
            .input("State", sql.NVarChar, State)
            .input("Country", sql.NVarChar, Country)
            .input("PostalCode", sql.NVarChar, PostalCode)
            .query(`
                UPDATE Customers
                SET 
                    FullName=@FullName,
                    Email=@Email,
                    Phone=@Phone,
                    AddressLine1=@AddressLine1,
                    AddressLine2=@AddressLine2,
                    City=@City,
                    State=@State,
                    Country=@Country,
                    PostalCode=@PostalCode
                WHERE CustomerID=@CustomerID
            `);

        // AUDIT SUCCESS
        await logAudit({
            req,

            userId: decoded.customerId,
            userName: decoded.email,

            module: "Customer",
            actionType: "CUSTOMER_PROFILE_UPDATED",

            description: `Customer profile updated by ${decoded.email}`,

            oldValues: {
                fullName: oldData?.FullName,
                email: oldData?.Email,
                phone: oldData?.Phone
            },

            newValues: {
                FullName,
                Email,
                Phone
            },

            status: "SUCCESS"
        });

        res.json({
            success: true
        });

    } catch (err) {

        console.error("CUSTOMER PROFILE UPDATE ERROR:", err);

        await logAudit({
            req,

            module: "Customer",
            actionType: "CUSTOMER_PROFILE_UPDATE_FAILED",

            description: "Customer self profile update failed",

            status: "FAILED",

            newValues: {
                error: err.message
            }
        });

        res.status(500).json({
            success: false
        });
    }
});

module.exports = router;