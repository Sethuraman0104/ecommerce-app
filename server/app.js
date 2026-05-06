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

    const url = `http://localhost:${PORT}`;

    console.log(`🟢 Server running on ${url}`);
    console.log(`🏠 Home: ${url}`);
    console.log(`🔐 Admin: ${url}/admin-login.html`);

    /* =========================
       AUTO OPEN BROWSER
    ========================= */
    if (process.env.AUTO_OPEN !== "false") {

        let command;

        if (process.platform === "win32") {
            command = `start ${url}`;
        } else if (process.platform === "darwin") {
            command = `open ${url}`;
        } else {
            command = `xdg-open ${url}`;
        }

        exec(command);
    }
});