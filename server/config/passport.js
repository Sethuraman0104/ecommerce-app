const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { poolPromise } = require("../config/db");

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {

    try {
        const pool = await poolPromise;

        const email = profile.emails[0].value;
        const name = profile.displayName;

        let result = await pool.request()
            .input("Email", email)
            .query(`SELECT * FROM Customers WHERE Email=@Email`);

        let customer;

        if (!result.recordset.length) {

            const insert = await pool.request()
                .input("FullName", name)
                .input("Email", email)
                .query(`
                    INSERT INTO Customers (FullName, Email, CreatedAt)
                    OUTPUT INSERTED.*
                    VALUES (@FullName, @Email, GETDATE())
                `);

            customer = insert.recordset[0];

        } else {
            customer = result.recordset[0];
        }

        return done(null, customer);

    } catch (err) {
        return done(err, null);
    }
}));

module.exports = passport;