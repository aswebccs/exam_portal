require("dotenv").config();
const express = require("express");
const cors = require("cors");
const examModuleRoutes = require("./routes/examModuleRoutes");
const examManagementCompatRoutes = require("./routes/examManagementCompatRoutes");
const initSchema = require("./schema/initSchema");

const app = express();

const allowedOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "exam-portal-backend" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/exam-module", examModuleRoutes);
app.use("/api/exam-management", examManagementCompatRoutes);

let initPromise = null;

const shouldAutoInitSchema = () => {
  const flag = String(process.env.AUTO_INIT_SCHEMA ?? "true").trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(flag);
};

const ensureInitialized = async () => {
  if (!shouldAutoInitSchema()) {
    return;
  }

  if (!initPromise) {
    initPromise = initSchema().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
};

const startServer = async () => {
  try {
    await ensureInitialized();
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize schema:", error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  ensureInitialized,
  startServer,
};
