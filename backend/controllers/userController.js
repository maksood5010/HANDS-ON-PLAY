import bcrypt from "bcryptjs";
import {
  createUser,
  deleteUserById,
  findUserById,
  listUsers,
  listUsersByCompanyId,
  countCompanyAdmins,
  updateUser,
  userExists,
  userExistsExcludingId,
} from "../models/userModel.js";

const normalizeRole = (role) => {
  if (!role) return null;
  if (role === "platform_super_admin" || role === "company_admin" || role === "company_user") return role;
  return null;
};

export const listUsersHandler = async (req, res) => {
  try {
    const requester = req.user;
    const queryCompanyId = req.query.company_id ? parseInt(req.query.company_id, 10) : null;

    // Company admins: always limited to their own company
    if (requester.role !== "platform_super_admin") {
      const users = await listUsersByCompanyId(requester.company_id);
      return res.json({ success: true, users });
    }

    // Platform super-admin: list all or filter by company_id
    if (queryCompanyId && Number.isFinite(queryCompanyId)) {
      const users = await listUsersByCompanyId(queryCompanyId);
      return res.json({ success: true, users });
    }

    const users = await listUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createUserHandler = async (req, res) => {
  try {
    const { username, password, role, company_id } = req.body;
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const normalizedRole = normalizeRole(role) || "company_user";
    const requester = req.user;

    if (!normalizedUsername) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!normalizedRole) {
      return res.status(400).json({ error: "Role must be platform_super_admin, company_admin, or company_user" });
    }

    const exists = await userExists(normalizedUsername);
    if (exists) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Company admins can only create users in their company and cannot create platform super-admins.
    let targetCompanyId = requester.company_id;
    if (requester.role === "platform_super_admin") {
      if (company_id !== undefined) {
        const parsed = parseInt(company_id, 10);
        if (!Number.isFinite(parsed)) {
          return res.status(400).json({ error: "Invalid company_id" });
        }
        targetCompanyId = parsed;
      }
    } else {
      if (normalizedRole === "platform_super_admin") {
        return res.status(403).json({ error: "Only platform super-admin can create platform super-admin users" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(targetCompanyId, normalizedUsername, hashedPassword, normalizedRole);
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
    const requester = req.user;

    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const existing = await findUserById(targetId);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (requester.role !== "platform_super_admin" && existing.company_id !== requester.company_id) {
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
        return res.status(400).json({ error: "Role must be platform_super_admin, company_admin, or company_user" });
      }

      if (requester.role !== "platform_super_admin" && normalizedRole === "platform_super_admin") {
        return res.status(403).json({ error: "Only platform super-admin can assign platform_super_admin role" });
      }

      // Prevent demoting the last company_admin in a company
      if (existing.role === "company_admin" && normalizedRole !== "company_admin") {
        const admins = await countCompanyAdmins(existing.company_id);
        if (admins <= 1) {
          return res.status(400).json({ error: "Cannot remove the last company admin" });
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
    const requester = req.user;

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

    if (requester.role !== "platform_super_admin" && existing.company_id !== requester.company_id) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "company_admin") {
      const admins = await countCompanyAdmins(existing.company_id);
      if (admins <= 1) {
        return res.status(400).json({ error: "Cannot delete the last company admin" });
      }
    }

    await deleteUserById(targetId);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

