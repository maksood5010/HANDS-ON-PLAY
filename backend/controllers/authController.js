import bcrypt from "bcryptjs";
import { findUserByUsername } from "../models/userModel.js";

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
    res.status(500).json({ error: "Internal server error" });
  }
};

