import pool from "../config/db.js";

export const findUserByUsername = async (username) => {
  const result = await pool.query(
    "SELECT id, username, password FROM users WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
};

export const createUser = async (username, hashedPassword) => {
  const result = await pool.query(
    "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
    [username, hashedPassword]
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

