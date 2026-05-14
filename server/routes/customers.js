const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const sql = require('mssql');

const { poolPromise } = require('../config/db');
const logAudit = require('../utils/auditLogger');
const getCurrentUser = require('../utils/getCurrentUser'); // ✅ NEW (single source)

/* =================================================
   GET ALL CUSTOMERS
================================================= */
router.get('/', async (req, res) => {

    const currentUser = getCurrentUser(req);

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

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_LIST_VIEW",

            description: "Viewed customers list",

            status: "SUCCESS"
        });

        res.json(result.recordset);

    } catch (err) {

        console.error("GET CUSTOMERS ERROR:", err);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_LIST_FAILED",

            description: "Failed to load customers list",

            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({ message: "Server error" });
    }
});

/* =================================================
   CREATE CUSTOMER
================================================= */
router.post('/', async (req, res) => {

    const currentUser = getCurrentUser(req);

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

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

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

                    userId: currentUser.userId,
                    userName: currentUser.userName,
                    userType: currentUser.userType,

                    module: "Customer",
                    actionType: "CUSTOMER_DUPLICATE",

                    description: `Duplicate customer attempted: ${email}`,

                    status: "FAILED",

                    newValues: { email }
                });

                return res.status(400).json({
                    message: "Customer email already exists"
                });
            }
        }

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
                    FullName, Email, Phone,
                    City, State, Country,
                    PostalCode, AddressLine1, AddressLine2,
                    CreatedAt
                )
                VALUES
                (
                    @FullName, @Email, @Phone,
                    @City, @State, @Country,
                    @PostalCode, @AddressLine1, @AddressLine2,
                    GETDATE()
                )
            `);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

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

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_CREATE_FAILED",

            description: "Customer creation failed",

            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({
            message: "Insert failed",
            error: err.message
        });
    }
});

/* =================================================
   UPDATE CUSTOMER (FULL AUDIT FIXED)
================================================= */
router.put('/:id', async (req, res) => {

    const currentUser = getCurrentUser(req);

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

        /* =========================
           GET OLD VALUES (FULL SNAPSHOT)
        ========================= */
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
                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Customer",
                actionType: "CUSTOMER_UPDATE_FAILED",
                description: `Customer not found ID=${id}`,
                status: "FAILED"
            });

            return res.status(404).json({ message: "Customer not found" });
        }

        const oldCustomer = oldRes.recordset[0];

        /* =========================
           UPDATE CUSTOMER
        ========================= */
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
                    FullName=@FullName,
                    Email=@Email,
                    Phone=@Phone,
                    City=@City,
                    State=@State,
                    Country=@Country,
                    PostalCode=@PostalCode,
                    AddressLine1=@AddressLine1,
                    AddressLine2=@AddressLine2
                WHERE CustomerID=@CustomerID
            `);

        /* =========================
           BUILD FULL OLD + NEW SNAPSHOT
        ========================= */
        const oldValues = {
            customerId: oldCustomer.CustomerID,
            fullName: oldCustomer.FullName,
            email: oldCustomer.Email,
            phone: oldCustomer.Phone,
            city: oldCustomer.City,
            state: oldCustomer.State,
            country: oldCustomer.Country,
            postalCode: oldCustomer.PostalCode,
            addressLine1: oldCustomer.AddressLine1,
            addressLine2: oldCustomer.AddressLine2
        };

        const newValues = {
            customerId: id,
            fullName,
            email,
            phone,
            city,
            state,
            country,
            postalCode,
            addressLine1,
            addressLine2
        };

        /* =========================
           AUDIT LOG (FULL FIX)
        ========================= */
        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_UPDATED",
            description: `Customer updated: ${oldCustomer.FullName}`,

            oldValues,
            newValues,

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Customer updated successfully"
        });

    } catch (err) {

        console.error("UPDATE CUSTOMER ERROR:", err);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_UPDATE_FAILED",
            description: "Customer update failed",
            status: "FAILED",
            newValues: { error: err.message }
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

    const currentUser = getCurrentUser(req);

    try {

        const id = req.params.id;

        const pool = await poolPromise;

        const customerRes = await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                SELECT * FROM Customers WHERE CustomerID=@CustomerID
            `);

        if (!customerRes.recordset.length) {

            await logAudit({
                req,
                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Customer",
                actionType: "CUSTOMER_DELETE_FAILED",

                description: `Customer not found ID=${id}`,

                status: "FAILED"
            });

            return res.status(404).json({ message: "Customer not found" });
        }

        const customer = customerRes.recordset[0];

        await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                DELETE FROM Customers WHERE CustomerID=@CustomerID
            `);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_DELETED",

            description: `Deleted customer ${customer.FullName}`,

            oldValues: {
                customerId: customer.CustomerID,
                fullName: customer.FullName
            },

            status: "SUCCESS"
        });

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });

    } catch (err) {

        console.error("DELETE CUSTOMER ERROR:", err);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_DELETE_FAILED",

            description: "Customer deletion failed",

            status: "FAILED",

            newValues: { error: err.message }
        });

        res.status(500).json({
            message: "Delete failed",
            error: err.message
        });
    }
});

/* =================================================
   CUSTOMER SELF UPDATE (FULL AUDIT FIXED)
================================================= */
router.put('/update', async (req, res) => {

    const currentUser = getCurrentUser(req);

    try {

        if (!currentUser.userId) {

            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

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

        /* =========================
           GET OLD DATA (FULL SNAPSHOT)
        ========================= */
        const oldRes = await pool.request()
            .input("CustomerID", sql.Int, currentUser.userId)
            .query(`
                SELECT *
                FROM Customers
                WHERE CustomerID=@CustomerID
            `);

        const oldData = oldRes.recordset[0];

        if (!oldData) {

            await logAudit({
                req,

                userId: currentUser.userId,
                userName: currentUser.userName,
                userType: currentUser.userType,

                module: "Customer",
                actionType: "CUSTOMER_PROFILE_UPDATE_FAILED",
                description: "Customer not found during self update",
                status: "FAILED"
            });

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        /* =========================
           UPDATE CUSTOMER
        ========================= */
        await pool.request()
            .input("CustomerID", sql.Int, currentUser.userId)
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

        /* =========================
           BUILD FULL OLD VALUES
        ========================= */
        const oldValues = {
            customerId: oldData.CustomerID,
            fullName: oldData.FullName,
            email: oldData.Email,
            phone: oldData.Phone,
            addressLine1: oldData.AddressLine1,
            addressLine2: oldData.AddressLine2,
            city: oldData.City,
            state: oldData.State,
            country: oldData.Country,
            postalCode: oldData.PostalCode
        };

        /* =========================
           BUILD FULL NEW VALUES
        ========================= */
        const newValues = {
            customerId: currentUser.userId,
            fullName: FullName,
            email: Email,
            phone: Phone,
            addressLine1: AddressLine1,
            addressLine2: AddressLine2,
            city: City,
            state: State,
            country: Country,
            postalCode: PostalCode
        };

        /* =========================
           AUDIT LOG (FULL FIXED)
        ========================= */
        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_PROFILE_UPDATED",

            description: `Customer profile updated by ${currentUser.userName}`,

            oldValues,
            newValues,

            status: "SUCCESS"
        });

        res.json({
            success: true
        });

    } catch (err) {

        console.error("CUSTOMER PROFILE UPDATE ERROR:", err);

        await logAudit({
            req,

            userId: currentUser.userId,
            userName: currentUser.userName,
            userType: currentUser.userType,

            module: "Customer",
            actionType: "CUSTOMER_PROFILE_UPDATE_FAILED",
            description: "Customer self profile update failed",
            status: "FAILED",
            newValues: { error: err.message }
        });

        res.status(500).json({
            success: false
        });
    }
});

module.exports = router;