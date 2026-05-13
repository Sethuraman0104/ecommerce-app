const express = require('express');
const router = express.Router();

const sql = require('mssql');
const { poolPromise } = require('../config/db');

/* =========================
   IMPORT EXPORT LIBS
========================= */
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/* =========================
   FETCH DATA HELPER
========================= */
async function getReportData(type) {

    const pool = await poolPromise;

    switch (type) {

        case "daily-sales":
            return await pool.request().query(`
                SELECT
                    CAST(CreatedAt AS DATE) AS SaleDate,
                    COUNT(*) AS TotalOrders,
                    SUM(TotalAmount) AS TotalSales
                FROM Orders
                GROUP BY CAST(CreatedAt AS DATE)
                ORDER BY SaleDate DESC
            `);

        case "monthly-sales":
            return await pool.request().query(`
                SELECT
                    YEAR(CreatedAt) AS Year,
                    MONTH(CreatedAt) AS Month,
                    COUNT(*) AS OrdersCount,
                    SUM(TotalAmount) AS TotalSales
                FROM Orders
                GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
                ORDER BY Year DESC, Month DESC
            `);

        case "top-products":
            return await pool.request().query(`
                SELECT TOP 10
                    P.Name,
                    SUM(OI.Quantity) AS TotalSold,
                    SUM(OI.Quantity * OI.Price) AS Revenue
                FROM OrderItems OI
                INNER JOIN Products P ON OI.ProductID = P.ProductID
                GROUP BY P.Name
                ORDER BY TotalSold DESC
            `);

        case "low-stock":
            return await pool.request().query(`
                SELECT ProductID, Name, Stock, Price
                FROM Products
                WHERE Stock <= 10
                ORDER BY Stock ASC
            `);

        case "customers":
            return await pool.request().query(`
                SELECT CustomerID, FullName, Email, Phone, City, Country, CreatedAt
                FROM Customers
                ORDER BY CreatedAt DESC
            `);

        case "payments":
            return await pool.request().query(`
                SELECT
                    P.PaymentID,
                    O.OrderID,
                    C.FullName,
                    P.PaymentMethod,
                    P.PaymentStatus,
                    O.TotalAmount,
                    P.PaidAt
                FROM Payments P
                INNER JOIN Orders O ON P.OrderID = O.OrderID
                INNER JOIN Customers C ON O.CustomerID = C.CustomerID
                ORDER BY P.PaidAt DESC
            `);

        case "coupon-usage":
            return await pool.request().query(`
                SELECT
                    C.Code,
                    COUNT(O.OrderID) AS TotalOrders,
                    SUM(O.DiscountAmount) AS TotalDiscount
                FROM Coupons C
                LEFT JOIN Orders O ON C.CouponID = O.CouponID
                GROUP BY C.Code
                ORDER BY TotalOrders DESC
            `);

        case "audit-logs":
            return await pool.request().query(`
                SELECT TOP 100
                    A.LogID,
                    A.Action,
                    U.Name AS UserName,
                    A.CreatedAt
                FROM AuditLogs A
                LEFT JOIN Users U ON A.UserID = U.UserID
                ORDER BY A.CreatedAt DESC
            `);

        default:
            throw new Error("Invalid report type");
    }
}

/* =========================
   NORMAL API
========================= */
router.get('/:type', async (req, res) => {

    try {

        const result = await getReportData(req.params.type);

        res.json(result.recordset);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* =========================
   EXCEL EXPORT (SERVER SIDE)
========================= */
router.get('/export/excel/:type', async (req, res) => {

    try {

        const result = await getReportData(req.params.type);
        const data = result.recordset;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Report');

        if (data.length > 0) {

            sheet.columns = Object.keys(data[0]).map(key => ({
                header: key,
                key: key,
                width: 25
            }));

            data.forEach(row => sheet.addRow(row));
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename=${req.params.type}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* =========================
   PDF EXPORT (SERVER SIDE)
========================= */
router.get('/export/pdf/:type', async (req, res) => {

    try {

        const result = await getReportData(req.params.type);
        const data = result.recordset;

        const doc = new PDFDocument({ margin: 30 });

        res.setHeader(
            'Content-Type',
            'application/pdf'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename=${req.params.type}.pdf`
        );

        doc.pipe(res);

        doc.fontSize(16).text(
            `Report: ${req.params.type.toUpperCase()}`,
            { align: 'center' }
        );

        doc.moveDown();

        if (data.length > 0) {

            const columns = Object.keys(data[0]);

            data.forEach(row => {

                columns.forEach(col => {

                    doc.fontSize(10).text(`${col}: ${row[col]}`);
                });

                doc.moveDown();
            });
        }

        doc.end();

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;