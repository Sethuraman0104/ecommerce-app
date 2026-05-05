const express = require('express');
const router = express.Router();
const { poolPromise } = require('../config/db');
const sql = require('mssql');


// =========================
// GET ALL CUSTOMERS
// =========================
router.get('/', async (req, res) => {
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

        res.json(result.recordset);

    } catch (err) {
        console.error("GET CUSTOMERS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// =========================
// CREATE CUSTOMER
// =========================
router.post('/', async (req, res) => {

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

        const pool = await poolPromise;

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

        res.json({ message: "Customer added successfully" });

    } catch (err) {
        console.error("CREATE CUSTOMER ERROR:", err);
        res.status(500).json({
            message: "Insert failed",
            error: err.message
        });
    }
});


// =========================
// UPDATE CUSTOMER
// =========================
router.put('/:id', async (req, res) => {

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

        res.json({ message: "Customer updated successfully" });

    } catch (err) {
        console.error("UPDATE CUSTOMER ERROR:", err);
        res.status(500).json({
            message: "Update failed",
            error: err.message
        });
    }
});


// =========================
// DELETE CUSTOMER
// =========================
router.delete('/:id', async (req, res) => {

    try {

        const id = req.params.id;

        const pool = await poolPromise;

        await pool.request()
            .input('CustomerID', sql.Int, id)
            .query(`
                DELETE FROM Customers
                WHERE CustomerID = @CustomerID
            `);

        res.json({ message: "Customer deleted successfully" });

    } catch (err) {
        console.error("DELETE CUSTOMER ERROR:", err);
        res.status(500).json({
            message: "Delete failed",
            error: err.message
        });
    }
});

module.exports = router;