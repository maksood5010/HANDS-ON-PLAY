import bcrypt from "bcryptjs";
import {
  countAdmins,
  createUser,
  deleteUserById,
  findUserById,
  listUsers,
  updateUser,
  userExists,
  userExistsExcludingId,
} from "../models/userModel.js";

const normalizeRole = (role) => {
  if (!role) return null;
  if (role === "Admin" || role === "Customer") return role;
  return null;
};

export const listUsersHandler = async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createUserHandler = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const normalizedRole = normalizeRole(role) || "Customer";

    if (!normalizedUsername) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!normalizedRole) {
      return res.status(400).json({ error: "Role must be Admin or Customer" });
    }

    const exists = await userExists(normalizedUsername);
    if (exists) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(normalizedUsername, hashedPassword, normalizedRole);
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id);

    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const existing = await findUserById(targetId);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const fields = {};

    if (req.body.username !== undefined) {
      const normalizedUsername = typeof req.body.username === "string" ? req.body.username.trim() : "";
      if (!normalizedUsername) {
        return res.status(400).json({ error: "Username cannot be empty" });
      }
      const exists = await userExistsExcludingId(normalizedUsername, targetId);
      if (exists) {
        return res.status(409).json({ error: "Username already exists" });
      }
      fields.username = normalizedUsername;
    }

    if (req.body.password !== undefined) {
      if (typeof req.body.password !== "string" || req.body.password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      fields.password = await bcrypt.hash(req.body.password, 10);
    }

    if (req.body.role !== undefined) {
      const normalizedRole = normalizeRole(req.body.role);
      if (!normalizedRole) {
        return res.status(400).json({ error: "Role must be Admin or Customer" });
      }

      // Optional safety: prevent demoting the last Admin
      if (existing.role === "Admin" && normalizedRole !== "Admin") {
        const admins = await countAdmins();
        if (admins <= 1) {
          return res.status(400).json({ error: "Cannot remove the last Admin" });
        }
      }

      fields.role = normalizedRole;
    }

    const updated = await updateUser(targetId, fields);
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id);
    const currentUserId = req.user?.id;

    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (currentUserId === targetId) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const existing = await findUserById(targetId);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "Admin") {
      const admins = await countAdmins();
      if (admins <= 1) {
        return res.status(400).json({ error: "Cannot delete the last Admin" });
      }
    }

    await deleteUserById(targetId);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

