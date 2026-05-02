import {
  createCompany,
  deleteCompanyById,
  getCompanyById,
  listCompanies,
  updateCompany,
} from "../models/companyModel.js";
import { ensureAllDevicesGroup } from "../models/deviceGroupModel.js";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deleteObject, putObject } from "../services/storage/index.js";

const normalizeSlug = (slug) => {
  if (slug === undefined) return undefined;
  if (slug === null) return null;
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  return normalized;
};

const normalizePaymentCycle = (cycle) => {
  if (typeof cycle !== "string") return null;
  const c = cycle.trim().toLowerCase();
  if (c === "monthly" || c === "yearly" || c === "one_time") return c;
  return null;
};

const parsePurchaseDate = (raw) => {
  if (typeof raw !== "string" && !(raw instanceof Date)) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Use ISO date (YYYY-MM-DD) for DATE column
  return d.toISOString().slice(0, 10);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isSpacesDriver = () =>
  String(process.env.UPLOAD_DRIVER || "spaces")
    .trim()
    .toLowerCase() === "spaces";

const safeExtFromMimeOrName = ({ mimetype, originalname, filename }) => {
  const extFromName = path.extname(originalname || filename || "").toLowerCase();
  if (extFromName) return extFromName;
  if (typeof mimetype === "string") {
    if (mimetype === "image/png") return ".png";
    if (mimetype === "image/jpeg") return ".jpg";
    if (mimetype === "image/webp") return ".webp";
    if (mimetype === "image/gif") return ".gif";
    if (mimetype === "image/svg+xml") return ".svg";
  }
  return "";
};

const moveCompanyLogoIfNeeded = async ({ file, companyId }) => {
  if (!file?.path || !companyId) return null;

  // If upload middleware stored directly under companies/<id>, keep its relative path.
  const normalized = file.path.replaceAll("\\", "/");
  const uploadsIdx = normalized.lastIndexOf("/uploads/");
  if (uploadsIdx >= 0) {
    const rel = normalized.slice(uploadsIdx + "/uploads/".length);
    if (rel.startsWith(`companies/${companyId}/`)) return rel;
  }

  // Otherwise move from tmp to companies/<id>
  const uploadsDir = path.join(__dirname, "../uploads");
  const companyDir = path.join(uploadsDir, `companies/${companyId}`);
  await fs.promises.mkdir(companyDir, { recursive: true });

  const ext = path.extname(file.originalname || file.filename || "").toLowerCase();
  const destFilename = file.filename?.startsWith("logo-")
    ? file.filename
    : `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ""}`;
  const destAbs = path.join(companyDir, destFilename);

  await fs.promises.rename(file.path, destAbs);
  return `companies/${companyId}/${destFilename}`;
};

const storeCompanyLogoIfNeeded = async ({ file, companyId, companySlug }) => {
  if (!file) return null;

  if (isSpacesDriver()) {
    if (!companySlug || typeof companySlug !== "string") return null;
    if (!file.buffer) return null;

    const ext = safeExtFromMimeOrName(file);
    const key = `companies/${companySlug}/logos/logo-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;

    await putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    });
    return key;
  }

  return await moveCompanyLogoIfNeeded({ file, companyId });
};

const extractAdminCreds = (body) => {
  const rawAdmin = body?.admin;

  // Common FormData patterns: admin[username], admin[password]
  const bracketUsername = body?.["admin[username]"];
  const bracketPassword = body?.["admin[password]"];
  if (typeof bracketUsername === "string" || typeof bracketPassword === "string") {
    return {
      username: typeof bracketUsername === "string" ? bracketUsername.trim() : "",
      password: typeof bracketPassword === "string" ? bracketPassword : "",
    };
  }

  // Alternative flat fields for multipart
  if (typeof body?.admin_username === "string" || typeof body?.admin_password === "string") {
    return {
      username: typeof body.admin_username === "string" ? body.admin_username.trim() : "",
      password: typeof body.admin_password === "string" ? body.admin_password : "",
    };
  }

  // JSON body: admin object
  if (rawAdmin && typeof rawAdmin === "object") {
    return {
      username: typeof rawAdmin.username === "string" ? rawAdmin.username.trim() : "",
      password: typeof rawAdmin.password === "string" ? rawAdmin.password : "",
    };
  }

  // Multipart may send admin as JSON string
  if (typeof rawAdmin === "string" && rawAdmin.trim()) {
    try {
      const parsed = JSON.parse(rawAdmin);
      return {
        username: typeof parsed?.username === "string" ? parsed.username.trim() : "",
        password: typeof parsed?.password === "string" ? parsed.password : "",
      };
    } catch {
      return { username: "", password: "" };
    }
  }

  return { username: "", password: "" };
};

const generateTempPassword = () => {
  // Human-friendly, avoid ambiguous chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const listCompaniesHandler = async (_req, res) => {
  try {
    const companies = await listCompanies();
    return res.json({ success: true, companies });
  } catch (error) {
    console.error("Error listing companies:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getCompanyAdminHandler = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const result = await pool.query(
      `SELECT id, company_id, username, role, created_at
       FROM users
       WHERE company_id = $1 AND role = 'company_admin'
       ORDER BY id ASC
       LIMIT 1`,
      [companyId]
    );

    const adminUser = result.rows[0] || null;
    if (!adminUser) return res.status(404).json({ error: "Company admin not found" });

    return res.json({ success: true, adminUser });
  } catch (error) {
    console.error("Error fetching company admin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const resetCompanyAdminPasswordHandler = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const adminRes = await pool.query(
      `SELECT id, username
       FROM users
       WHERE company_id = $1 AND role = 'company_admin'
       ORDER BY id ASC
       LIMIT 1`,
      [companyId]
    );
    const admin = adminRes.rows[0];
    if (!admin) return res.status(404).json({ error: "Company admin not found" });

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, admin.id]);

    return res.json({
      success: true,
      adminUser: { id: admin.id, username: admin.username },
      tempPassword,
    });
  } catch (error) {
    console.error("Error resetting company admin password:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getCompanyHandler = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.json({ success: true, company });
  } catch (error) {
    console.error("Error fetching company:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createCompanyHandler = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const slug = normalizeSlug(req.body?.slug);
    const purchase_date = parsePurchaseDate(req.body?.purchase_date);
    const payment_cycle = normalizePaymentCycle(req.body?.payment_cycle);
    const contact_name =
      typeof req.body?.contact_name === "string" && req.body.contact_name.trim()
        ? req.body.contact_name.trim()
        : null;
    const contact_email =
      typeof req.body?.contact_email === "string" && req.body.contact_email.trim()
        ? req.body.contact_email.trim()
        : null;
    const contact_phone =
      typeof req.body?.contact_phone === "string" && req.body.contact_phone.trim()
        ? req.body.contact_phone.trim()
        : null;
    const additional_info =
      typeof req.body?.additional_info === "string" && req.body.additional_info.trim()
        ? req.body.additional_info.trim()
        : null;

    const rawDeviceLimit = req.body?.device_limit;
    const device_limit = Number.isFinite(parseInt(rawDeviceLimit, 10))
      ? parseInt(rawDeviceLimit, 10)
      : NaN;

    const { username: adminUsername, password: adminPassword } = extractAdminCreds(req.body);

    if (!name) return res.status(400).json({ error: "Company name is required" });
    if (req.body?.slug === undefined) {
      return res.status(400).json({ error: "Company slug is required" });
    }
    if (slug === null) return res.status(400).json({ error: "Invalid slug" });

    if (!purchase_date) return res.status(400).json({ error: "purchase_date is required" });
    if (!payment_cycle) return res.status(400).json({ error: "Invalid payment_cycle" });
    if (!Number.isFinite(device_limit) || device_limit < 0) {
      return res.status(400).json({ error: "device_limit must be an integer >= 0" });
    }

    if (!adminUsername) return res.status(400).json({ error: "Admin username is required" });
    if (adminPassword.length < 6) {
      return res.status(400).json({ error: "Admin password must be at least 6 characters" });
    }

    // Transaction: create company + initial company admin
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Enforce global username uniqueness up-front for friendly 409
      const userExists = await client.query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [
        adminUsername,
      ]);
      if (userExists.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Username already exists" });
      }

      const companyRes = await client.query(
        `INSERT INTO companies (
            name,
            slug,
            purchase_date,
            payment_cycle,
            contact_name,
            contact_email,
            contact_phone,
            device_limit,
            additional_info,
            logo_path
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING
            id, name, slug,
            purchase_date, payment_cycle,
            contact_name, contact_email, contact_phone,
            device_limit, additional_info,
            logo_path,
            created_at`,
        [
          name,
          slug,
          purchase_date,
          payment_cycle,
          contact_name,
          contact_email,
          contact_phone,
          device_limit,
          additional_info,
          null,
        ]
      );

      let company = companyRes.rows[0];

      // If a logo file was uploaded, move it and persist logo_path.
      if (req.file) {
        const logo_path = await storeCompanyLogoIfNeeded({
          file: req.file,
          companyId: company.id,
          companySlug: slug,
        });
        if (logo_path) {
          const logoRes = await client.query(
            `UPDATE companies
             SET logo_path = $1
             WHERE id = $2
             RETURNING
               id, name, slug,
               purchase_date, payment_cycle,
               contact_name, contact_email, contact_phone,
               device_limit, additional_info,
               logo_path,
               created_at`,
            [logo_path, company.id]
          );
          company = logoRes.rows[0] || company;
        }
      }

      const hashed = await bcrypt.hash(adminPassword, 10);
      const adminUserRes = await client.query(
        `INSERT INTO users (company_id, username, password, role)
         VALUES ($1, $2, $3, 'company_admin')
         RETURNING id, company_id, username, role, created_at`,
        [company.id, adminUsername, hashed]
      );

      await ensureAllDevicesGroup(company.id, client);

      await client.query("COMMIT");
      return res.status(201).json({
        success: true,
        company,
        adminUser: adminUserRes.rows[0],
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      if (txErr.code === "23505") {
        return res.status(409).json({ error: "Company slug already exists" });
      }
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating company:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Company slug already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCompanyHandler = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    // Preload company so we can use its slug for Spaces uploads.
    const existingCompany = await getCompanyById(companyId);
    if (!existingCompany) return res.status(404).json({ error: "Company not found" });

    const fields = {};
    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) return res.status(400).json({ error: "Company name cannot be empty" });
      fields.name = name;
    }
    if (req.body?.slug !== undefined) {
      return res.status(400).json({ error: "Company slug cannot be changed" });
    }
    if (req.body?.purchase_date !== undefined) {
      const purchase_date = parsePurchaseDate(req.body.purchase_date);
      if (!purchase_date) return res.status(400).json({ error: "Invalid purchase_date" });
      fields.purchase_date = purchase_date;
    }
    if (req.body?.payment_cycle !== undefined) {
      const payment_cycle = normalizePaymentCycle(req.body.payment_cycle);
      if (!payment_cycle) return res.status(400).json({ error: "Invalid payment_cycle" });
      fields.payment_cycle = payment_cycle;
    }
    if (req.body?.contact_name !== undefined) {
      fields.contact_name =
        typeof req.body.contact_name === "string" && req.body.contact_name.trim()
          ? req.body.contact_name.trim()
          : null;
    }
    if (req.body?.contact_email !== undefined) {
      fields.contact_email =
        typeof req.body.contact_email === "string" && req.body.contact_email.trim()
          ? req.body.contact_email.trim()
          : null;
    }
    if (req.body?.contact_phone !== undefined) {
      fields.contact_phone =
        typeof req.body.contact_phone === "string" && req.body.contact_phone.trim()
          ? req.body.contact_phone.trim()
          : null;
    }
    if (req.body?.additional_info !== undefined) {
      fields.additional_info =
        typeof req.body.additional_info === "string" && req.body.additional_info.trim()
          ? req.body.additional_info.trim()
          : null;
    }
    if (req.body?.device_limit !== undefined) {
      const device_limit = parseInt(req.body.device_limit, 10);
      if (!Number.isFinite(device_limit) || device_limit < 0) {
        return res.status(400).json({ error: "device_limit must be an integer >= 0" });
      }
      fields.device_limit = device_limit;
    }

    if (req.file) {
      const logo_path = await storeCompanyLogoIfNeeded({
        file: req.file,
        companyId,
        companySlug: existingCompany.slug,
      });
      if (logo_path) fields.logo_path = logo_path;
    }

    const updated = await updateCompany(companyId, fields);
    if (!updated) return res.status(404).json({ error: "Company not found" });

    return res.json({ success: true, company: updated });
  } catch (error) {
    console.error("Error updating company:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Company slug already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCompanyHandler = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    // If the company has devices/playlists/files, deleting it safely requires a dedicated
    // cascade strategy. We keep the default behavior conservative.
    const counts = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE company_id = $1`, [companyId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM devices WHERE company_id = $1`, [companyId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM playlists WHERE company_id = $1`, [companyId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM files WHERE company_id = $1`, [companyId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM device_groups WHERE company_id = $1`, [companyId]),
    ]);

    const userCount = counts[0].rows[0]?.count ?? 0;
    const deviceCount = counts[1].rows[0]?.count ?? 0;
    const playlistCount = counts[2].rows[0]?.count ?? 0;
    const fileCount = counts[3].rows[0]?.count ?? 0;
    const groupCount = counts[4].rows[0]?.count ?? 0;

    // Allow deleting a "fresh" company that only has its users and groups (including the
    // default "All devices" group). This avoids a deadlock where the last admin cannot be
    // deleted, and the company cannot be deleted because it still has that admin.
    if (deviceCount === 0 && playlistCount === 0 && fileCount === 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Remove groups first (should be safe because there are no devices/playlists).
        if (groupCount > 0) {
          await client.query(`DELETE FROM device_groups WHERE company_id = $1`, [companyId]);
        }

        // Remove users (safe because there are no other dependent records).
        if (userCount > 0) {
          await client.query(`DELETE FROM users WHERE company_id = $1`, [companyId]);
        }

        const deleted = await client.query(
          `DELETE FROM companies WHERE id = $1 RETURNING id`,
          [companyId]
        );
        if (deleted.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Company not found" });
        }

        await client.query("COMMIT");

        // Best-effort logo cleanup (non-fatal).
        const logoPath = company.logo_path;
        if (logoPath && typeof logoPath === "string") {
          try {
            if (isSpacesDriver()) {
              await deleteObject({ key: logoPath });
            } else {
              const uploadsDir = path.join(__dirname, "../uploads");
              const abs = path.join(uploadsDir, logoPath);
              await fs.promises.unlink(abs).catch(() => {});
            }
          } catch {
            // ignore
          }
        }

        return res.json({ success: true, message: "Company deleted successfully" });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    }

    if (userCount > 0 || deviceCount > 0 || playlistCount > 0 || fileCount > 0 || groupCount > 0) {
      return res.status(409).json({
        error:
          "Cannot delete company while it has data (users/devices/playlists/files/groups). Delete those first.",
        counts: {
          users: userCount,
          devices: deviceCount,
          playlists: playlistCount,
          files: fileCount,
          device_groups: groupCount,
        },
      });
    }

    const deleted = await deleteCompanyById(companyId);
    if (!deleted) return res.status(404).json({ error: "Company not found" });

    // Best-effort logo cleanup (non-fatal).
    const logoPath = company.logo_path;
    if (logoPath && typeof logoPath === "string") {
      try {
        if (isSpacesDriver()) {
          await deleteObject({ key: logoPath });
        } else {
          const uploadsDir = path.join(__dirname, "../uploads");
          const abs = path.join(uploadsDir, logoPath);
          await fs.promises.unlink(abs).catch(() => {});
        }
      } catch {
        // ignore
      }
    }

    return res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    if (error.code === "23503") {
      return res.status(409).json({
        error:
          "Cannot delete company due to existing related records. Delete company users/devices/playlists/files/groups first.",
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

