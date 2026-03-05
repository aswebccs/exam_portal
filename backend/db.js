const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "postgres",
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});


module.exports = pool;

