// api/middleware/checkAccess.js

module.exports = async function checkAccess(req, res, next) {
    try {
      // 🔹 Check if the user is authenticated via Passport session
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
  
      // 🔹 Optional: Safety check for can_login field (e.g., null in DB)
      if (req.user.can_login === false) {
        return res.status(403).json({
          message: "Your account is disabled or pending approval. Please contact support.",
        });
      }
  
      // 🔹 Proceed to the next middleware or route
      next();
    } catch (error) {
      console.error("❌ checkAccess middleware error:", error);
      res.status(500).json({ message: "Internal server error during access check" });
    }
  };
  