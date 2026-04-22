import pool from "../config/db.js";

export const findUserByUsername = async (username) => {
  const result = await pool.query(
    `SELECT u.id,
            u.company_id,
            u.username,
            u.password,
            u.role,
            c.name AS company_name
     FROM users u
     INNER JOIN companies c ON c.id = u.company_id
     WHERE u.username = $1`,
    [username]
  );
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT id, company_id, username, role, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

export const createUser = async (companyId, username, hashedPassword, role = "company_user") => {
  const result = await pool.query(
    "INSERT INTO users (company_id, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id, company_id, username, role",
    [companyId, username, hashedPassword, role]
  );
  return result.rows[0];
};

export const userExists = async (username) => {
  const result = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [username]
  );
  return result.rows.length > 0;
};

export const userExistsExcludingId = async (username, excludeId) => {
  const result = await pool.query(
    "SELECT id FROM users WHERE username = $1 AND id <> $2",
    [username, excludeId]
  );
  return result.rows.length > 0;
};

export const listUsers = async () => {
  const result = await pool.query(
    `SELECT u.id,
            u.company_id,
            c.name AS company_name,
            u.username,
            u.role,
            u.created_at
     FROM users u
     INNER JOIN companies c ON c.id = u.company_id
     ORDER BY u.id ASC`
  );
  return result.rows;
};

export const listUsersByCompanyId = async (companyId) => {
  const result = await pool.query(
    `SELECT u.id,
            u.company_id,
            c.name AS company_name,
            u.username,
            u.role,
            u.created_at
     FROM users u
     INNER JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = $1
     ORDER BY u.id ASC`,
    [companyId]
  );
  return result.rows;
};

export const countCompanyAdmins = async (companyId) => {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE company_id = $1 AND role = 'company_admin'",
    [companyId]
  );
  return result.rows[0] ? result.rows[0].count : 0;
};

export const updateUser = async (id, fields) => {
  const allowed = ["username", "password", "role"];
  const keys = Object.keys(fields || {}).filter((k) => allowed.includes(k));

  if (keys.length === 0) return null;

  const setClauses = [];
  const values = [];

  keys.forEach((k, idx) => {
    setClauses.push(`${k} = $${idx + 1}`);
    values.push(fields[k]);
  });

  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING id, company_id, username, role, created_at`,
    values
  );

  return result.rows[0] || null;
};

export const deleteUserById = async (id) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows[0] || null;
};

