import bcrypt from "bcryptjs";

const normalizePaymentCycle = (cycle) => {
  if (typeof cycle !== "string") return null;
  const c = cycle.trim().toLowerCase();
  if (c === "monthly" || c === "yearly" || c === "one_time") return c;
  return null;
};

const parseDateToISO = (raw) => {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

export async function bootstrapPlatform({ pool }) {
  const companyName = (process.env.BOOTSTRAP_COMPANY_NAME || "HOI").trim();
  const companySlug = (process.env.BOOTSTRAP_COMPANY_SLUG || "hoi").trim();
  const purchaseDate =
    parseDateToISO(process.env.BOOTSTRAP_COMPANY_PURCHASE_DATE) ||
    new Date().toISOString().slice(0, 10);
  const paymentCycle =
    normalizePaymentCycle(process.env.BOOTSTRAP_COMPANY_PAYMENT_CYCLE) || "one_time";
  const username = (process.env.BOOTSTRAP_SUPERADMIN_USERNAME || "admin").trim();
  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "admin123";

  if (!companyName) throw new Error("BOOTSTRAP_COMPANY_NAME is required");
  if (!companySlug) throw new Error("BOOTSTRAP_COMPANY_SLUG is required");
  if (!username) throw new Error("BOOTSTRAP_SUPERADMIN_USERNAME is required");
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("BOOTSTRAP_SUPERADMIN_PASSWORD must be at least 6 characters");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const companyRes = await client.query(
      `
      INSERT INTO companies (name, slug, purchase_date, payment_cycle, device_limit)
      SELECT $1, $2, $3, $4, 0
      WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = $2)
      RETURNING id
      `,
      [companyName, companySlug, purchaseDate, paymentCycle]
    );

    let companyId;
    if (companyRes.rows.length > 0) {
      companyId = companyRes.rows[0].id;
    } else {
      const existing = await client.query(`SELECT id FROM companies WHERE slug = $1 LIMIT 1`, [companySlug]);
      companyId = existing.rows[0]?.id;
    }

    if (!companyId) throw new Error("Bootstrap company was not created/found");

    const userExists = await client.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
    if (userExists.rows.length === 0) {
      const hashed = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (company_id, username, password, role)
         VALUES ($1, $2, $3, 'platform_super_admin')`,
        [companyId, username, hashed]
      );
      console.log(`Created platform super-admin user: ${username}`);
    } else {
      console.log("Platform super-admin user already exists (by username).");
    }

    await client.query("COMMIT");
    console.log("Bootstrap complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

