
const supabase = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from request header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access token is required"
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        // Verify token using Supabase
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // Attach authenticated user to request
        req.user = data.user;

        // Continue to next middleware or route
        next();

    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal authentication error"
        });
    }
};

module.exports = authMiddleware;
