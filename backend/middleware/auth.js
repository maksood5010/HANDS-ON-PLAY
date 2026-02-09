import { findUserById } from "../models/userModel.js";

// Simple auth middleware - in production, use JWT tokens
export const authenticate = (req, res, next) => {
  // For now, we'll get user_id from request body, query, or headers
  // In production, extract from JWT token
  // Safely check req.body (it may be undefined for GET requests or multipart/form-data)
  const userId = (req.body && req.body.user_id) || req.query.user_id || req.headers["x-user-id"];
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Store user info in request
  req.user = { id: parseInt(userId) };
  next();
};

export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (user.role !== "Admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Optional: More permissive middleware for testing
export const optionalAuth = (req, res, next) => {
  const userId = (req.body && req.body.user_id) || req.query.user_id || req.headers["x-user-id"];
  if (userId) {
    req.user = { id: parseInt(userId) };
  }
  next();
};

