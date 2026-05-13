const { poolPromise } = require('../config/db');

async function logAudit({
    req,
    userId = null,
    userName = null,

    module,
    actionType,

    description = "",

    oldValues = null,
    newValues = null,

    status = "SUCCESS"
}) {

    try {

        const pool = await poolPromise;

        await pool.request()

            .input("UserID", userId)
            .input("UserName", userName)

            .input("Module", module)
            .input("ActionType", actionType)

            .input("Description", description)

            .input("OldValues",
                oldValues ? JSON.stringify(oldValues) : null
            )

            .input("NewValues",
                newValues ? JSON.stringify(newValues) : null
            )

            .input(
                "IPAddress",
                req.ip ||
                req.connection?.remoteAddress ||
                null
            )

            .input(
                "UserAgent",
                req.headers['user-agent'] || null
            )

            .input("Status", status)

            .query(`
                INSERT INTO AuditLogs
                (
                    UserID,
                    UserName,

                    Module,
                    ActionType,

                    Description,

                    OldValues,
                    NewValues,

                    IPAddress,
                    UserAgent,

                    Status,
                    CreatedAt
                )
                VALUES
                (
                    @UserID,
                    @UserName,

                    @Module,
                    @ActionType,

                    @Description,

                    @OldValues,
                    @NewValues,

                    @IPAddress,
                    @UserAgent,

                    @Status,
                    GETDATE()
                )
            `);

    } catch (err) {

        console.error("AUDIT LOG ERROR:", err);
    }
}

module.exports = logAudit;