const sql = require('mssql');

// const config = {
//     user: 'ecommerce_user',
//     password: 'StrongPassword@123',
//     server: 'SETHULAPTOP\\SQLEXPRESS',
//     database: 'ECommerceDB',

//     options: {
//         encrypt: false,
//         trustServerCertificate: true
//     }
// };

const config = {
    user: 'ecommerce_user',
    password: 'StrongPassword@123',
    server: '01-181259\\SQLEXPRESS',
    database: 'ECommerceDB',

    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("✅ SQL Connected Successfully (SQL Auth)");
        return pool;
    })
    .catch(err => {
        console.error("❌ SQL Connection Failed:", err);
    });

module.exports = { sql, poolPromise };