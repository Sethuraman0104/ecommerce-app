const sql = require("mssql");
require("dotenv").config();

// Build configuration from environment variables
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,

    options: {
        encrypt: true, // required for Azure / cloud SQL
        trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === "true"
    }
};

// Create connection pool
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("✅ SQL Connected Successfully");
        return pool;
    })
    .catch(err => {
        console.error("❌ SQL Connection Failed:", err);
        throw err;
    });

module.exports = {
    sql,
    poolPromise
};