import pool from "../config/db.js";

export const createCompany = async ({
  name,
  slug = null,
  purchase_date,
  payment_cycle,
  contact_name = null,
  contact_email = null,
  contact_phone = null,
  device_limit = 0,
  additional_info = null,
  logo_path = null,
}) => {
  const result = await pool.query(
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
      logo_path,
    ]
  );
  return result.rows[0];
};

export const listCompanies = async () => {
  const result = await pool.query(
    `SELECT
        id, name, slug,
        purchase_date, payment_cycle,
        contact_name, contact_email, contact_phone,
        device_limit, additional_info,
        logo_path,
        created_at
     FROM companies
     ORDER BY id ASC`
  );
  return result.rows;
};

export const getCompanyById = async (companyId) => {
  const result = await pool.query(
    `SELECT
        id, name, slug,
        purchase_date, payment_cycle,
        contact_name, contact_email, contact_phone,
        device_limit, additional_info,
        logo_path,
        created_at
     FROM companies
     WHERE id = $1`,
    [companyId]
  );
  return result.rows[0] || null;
};

export const updateCompany = async (companyId, fields) => {
  const allowed = [
    "name",
    "slug",
    "purchase_date",
    "payment_cycle",
    "contact_name",
    "contact_email",
    "contact_phone",
    "device_limit",
    "additional_info",
    "logo_path",
  ];
  const keys = Object.keys(fields || {}).filter((k) => allowed.includes(k));
  if (keys.length === 0) return null;

  const setClauses = [];
  const values = [];

  keys.forEach((k, idx) => {
    setClauses.push(`${k} = $${idx + 1}`);
    values.push(fields[k]);
  });
  values.push(companyId);

  const result = await pool.query(
    `UPDATE companies
     SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING
        id, name, slug,
        purchase_date, payment_cycle,
        contact_name, contact_email, contact_phone,
        device_limit, additional_info,
        logo_path,
        created_at`,
    values
  );
  return result.rows[0] || null;
};

export const deleteCompanyById = async (companyId) => {
  const result = await pool.query(
    `DELETE FROM companies
     WHERE id = $1
     RETURNING id`,
    [companyId]
  );
  return result.rows[0] || null;
};

