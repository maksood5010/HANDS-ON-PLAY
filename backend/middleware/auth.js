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

// Optional: More permissive middleware for testing
export const optionalAuth = (req, res, next) => {
  const userId = (req.body && req.body.user_id) || req.query.user_id || req.headers["x-user-id"];
  if (userId) {
    req.user = { id: parseInt(userId) };
  }
  next();
};

