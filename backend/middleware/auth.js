import { findUserById } from "../models/userModel.js";

// Authentication middleware: attach full user (id + role) to req.user
// and ensure the user actually exists in the database.
export const authenticate = async (req, res, next) => {
  try {
    // Get user_id from body, query, or headers
    const rawUserId =
      (req.body && req.body.user_id) ||
      req.query.user_id ||
      req.headers["x-user-id"];

    if (!rawUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = parseInt(rawUserId, 10);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Attach full user context to the request (including role)
    req.user = {
      id: user.id,
      company_id: user.company_id,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const ensureAuthenticated = (req, res) => {
  const user = req.user;
  if (!user || !user.id) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (!user.company_id) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return user;
};

export const requirePlatformSuperAdmin = (req, res, next) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;
    if (user.role !== "platform_super_admin") {
      return res.status(403).json({ error: "Platform super-admin access required" });
    }
    next();
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const requireCompanyAdminOrPlatformSuperAdmin = (req, res, next) => {
  try {
    const user = ensureAuthenticated(req, res);
    if (!user) return;
    if (user.role !== "company_admin" && user.role !== "platform_super_admin") {
      return res.status(403).json({ error: "Company admin access required" });
    }
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

