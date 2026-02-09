import pool from "../config/db.js";

export const findUserByUsername = async (username) => {
  const result = await pool.query(
    "SELECT id, username, password, role FROM users WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
};

export const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT id, username, role, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

export const createUser = async (username, hashedPassword, role = "Customer") => {
  const result = await pool.query(
    "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
    [username, hashedPassword, role]
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
    "SELECT id, username, role, created_at FROM users ORDER BY id ASC"
  );
  return result.rows;
};

export const countAdmins = async () => {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE role = 'Admin'"
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
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING id, username, role, created_at`,
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

