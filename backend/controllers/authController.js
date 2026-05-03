import bcrypt from "bcryptjs";
import { findUserByUsername } from "../models/userModel.js";

const isDatabaseConnectionError = (err) => {
  if (!err) return false;
  const code = err.code;
  if (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "57P03"
  ) {
    return true;
  }
  if (Array.isArray(err.errors)) {
    return err.errors.some((e) => isDatabaseConnectionError(e));
  }
  return false;
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Find user in database
    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Compare password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Return success (in production, you'd generate a JWT token here)
    res.json({ 
      success: true, 
      message: "Login successful",
      user: {
        id: user.id,
        company_id: user.company_id,
        company_name: user.company_name,
        username: user.username,
        role: user.role,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    if (isDatabaseConnectionError(error)) {
      return res.status(503).json({
        error:
          "Cannot connect to the database. Start PostgreSQL and verify PGHOST, PGPORT, PGUSER, PGDATABASE in backend/.env.",
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

