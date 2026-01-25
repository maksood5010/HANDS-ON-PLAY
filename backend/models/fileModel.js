import pool from "../config/db.js";

export const saveFile = async (originalName, storedName, filePath, fileType, fileSize, mimeType, userId) => {
  const result = await pool.query(
    `INSERT INTO files (original_name, stored_name, file_path, file_type, file_size, mime_type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [originalName, storedName, filePath, fileType, fileSize, mimeType, userId]
  );
  return result.rows[0];
};

export const getFileById = async (fileId, userId) => {
  const result = await pool.query(
    `SELECT * FROM files 
     WHERE id = $1 AND user_id = $2`,
    [fileId, userId]
  );
  return result.rows[0] || null;
};

export const getFilesByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM files 
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const deleteFile = async (fileId, userId) => {
  const result = await pool.query(
    `DELETE FROM files 
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [fileId, userId]
  );
  return result.rows[0] || null;
};

