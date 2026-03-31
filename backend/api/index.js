const { app, ensureInitialized } = require("../index");

module.exports = async (req, res) => {
  try {
    await ensureInitialized();
    return app(req, res);
  } catch (error) {
    console.error("Initialization error:", error.message);
    return res.status(500).json({ success: false, message: "Server initialization failed" });
  }
};
