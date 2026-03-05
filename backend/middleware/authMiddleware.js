

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ SUPPORT BOTH OLD & NEW CODE
        req.userId = decoded.id;
        req.userType = decoded.user_type;

        req.user = {
            id: decoded.id,
            user_type: decoded.user_type
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = authMiddleware;

