const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const passport = require('./config/passport');

const app = express();

/* =========================
   TRUST PROXY (Render fix)
========================= */
app.set('trust proxy', 1);

/* =========================
   ENVIRONMENT
========================= */
const isProduction = process.env.NODE_ENV === "production";

/* =========================
   CORS (Local + Production)
========================= */
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://hrinfo-ecommerece.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {

        // Allow Postman/mobile apps/no-origin requests
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("Blocked by CORS:", origin);
            callback(new Error('CORS Not Allowed'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "25mb"
}));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, '../client')));

app.use('/assets',
    express.static(path.join(__dirname, '../client/assets'))
);

/* =========================
   PASSPORT
========================= */
app.use(passport.initialize());

/* =========================
   ROUTES
========================= */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customer-auth', require('./routes/customerAuth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/company', require('./routes/company'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/public', require('./routes/public'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/reports', require('./routes/reports'));

/* =========================
   HEALTH CHECK
========================= */
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        environment: isProduction ? "Production" : "Development",
        time: new Date()
    });
});

/* =========================
   DEFAULT PAGE
========================= */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {

    console.error("SERVER ERROR:", err);

    res.status(500).json({
        message: err.message || "Internal server error"
    });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

// Use localhost for local development
const HOST = isProduction ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {

    console.log('===================================');
    console.log(`🟢 Server running successfully`);
    console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`🚀 Server URL: http://${HOST}:${PORT}`);
    console.log('===================================');

    if (isProduction) {

        console.log(`🏠 Home: https://hrinfo-ecommerece.onrender.com`);
        console.log(`🔐 Admin: https://hrinfo-ecommerece.onrender.com/admin-login.html`);

    } else {

        console.log(`🏠 Home: http://localhost:${PORT}`);
        console.log(`🔐 Admin: http://localhost:${PORT}/admin-login.html`);

    }

    console.log('===================================');

});