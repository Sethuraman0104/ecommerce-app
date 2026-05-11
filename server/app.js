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
   CORS (Production safe)
========================= */
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, '../client')));
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));

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

/* =========================
   HEALTH CHECK (IMPORTANT FOR RENDER)
========================= */
app.get('/health', (req, res) => {
    res.json({ status: "OK", time: new Date() });
});

/* =========================
   DEFAULT PAGE
========================= */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
});

/* =========================
   START SERVER (RENDER FIX)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🟢 Server running on port ${PORT}`);
    console.log(`🏠 Home: https://hrinfo-ecommerece.onrender.com`);
    console.log(`🔐 Admin: https://hrinfo-ecommerece.onrender.com/admin-login.html`);
});