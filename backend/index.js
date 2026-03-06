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

const startServer = async () => {
  try {
    await initSchema();
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  } catch (error) {
    console.error("Failed to initialize schema:", error.message);
    process.exit(1);
  }
};

startServer();

