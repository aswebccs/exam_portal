const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "postgres",
    port: Number(process.env.DB_PORT || 5432),
    family: 4,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

// Prevent process crash on unexpected idle-client disconnects.
pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.code || err.message);
});

module.exports = pool;
