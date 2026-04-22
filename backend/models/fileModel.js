import pool from "../config/db.js";

export const saveFile = async (companyId, originalName, storedName, filePath, fileType, fileSize, mimeType, userId) => {
  const result = await pool.query(
    `INSERT INTO files (company_id, original_name, stored_name, file_path, file_type, file_size, mime_type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [companyId, originalName, storedName, filePath, fileType, fileSize, mimeType, userId]
  );
  return result.rows[0];
};

export const getFileById = async (fileId, companyId) => {
  const result = await pool.query(
    `SELECT * FROM files 
     WHERE id = $1 AND company_id = $2`,
    [fileId, companyId]
  );
  return result.rows[0] || null;
};

export const getFilesByCompanyId = async (companyId) => {
  const result = await pool.query(
    `SELECT * FROM files 
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows;
};

export const deleteFile = async (fileId, companyId) => {
  const result = await pool.query(
    `DELETE FROM files 
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [fileId, companyId]
  );
  return result.rows[0] || null;
};

