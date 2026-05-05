const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const { exec } = require('child_process');
const passport = require('./config/passport');

const app = express();

/* =========================
   CORS
========================= */
app.use(cors({ origin: "*" }));

/* =========================
   BODY LIMIT
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

// 🔐 ADMIN AUTH (Users table)
app.use('/api/auth', require('./routes/auth'));

// 🛒 CUSTOMER AUTH (Customers table)
app.use('/api/customer-auth', require('./routes/customerAuth'));

// 📦 PRODUCTS
app.use('/api/products', require('./routes/products'));

// 📂 CATEGORIES
app.use('/api/categories', require('./routes/categories'));

// 🏢 COMPANY INFO
app.use('/api/company', require('./routes/company'));

// ⚙️ SETTINGS
app.use('/api/settings', require('./routes/settings'));

// 👤 CUSTOMERS
app.use('/api/customers', require('./routes/customers'));

// 🛒 ORDERS
app.use('/api/orders', require('./routes/orders'));

// 💳 PAYMENTS
app.use('/api/payments', require('./routes/payments'));

// 🎟 COUPONS
app.use('/api/coupons', require('./routes/coupons'));

// 🌍 PUBLIC
app.use('/api/public', require('./routes/public'));

const profileRoutes = require('./routes/profile');

app.use('/api/profile', profileRoutes);

/* =========================
   DEFAULT PAGE
========================= */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Home: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin-login.html`);
});