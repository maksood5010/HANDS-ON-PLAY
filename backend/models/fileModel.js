import pool from "../config/db.js";

export const TRANSCODE_STATUS = {
  PENDING: "pending",
  READY: "ready",
  FAILED: "failed",
  SKIPPED: "skipped",
};

export const saveFile = async (
  companyId,
  originalName,
  storedName,
  filePath,
  fileType,
  fileSize,
  mimeType,
  userId
) => {
  const transcodeStatus =
    fileType === "video" ? TRANSCODE_STATUS.PENDING : TRANSCODE_STATUS.SKIPPED;

  const result = await pool.query(
    `INSERT INTO files (
       company_id, original_name, stored_name, file_path, file_type,
       file_size, mime_type, user_id, transcode_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      companyId,
      originalName,
      storedName,
      filePath,
      fileType,
      fileSize,
      mimeType,
      userId,
      transcodeStatus,
    ]
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

export const getFileByIdAnyCompany = async (fileId) => {
  const result = await pool.query(`SELECT * FROM files WHERE id = $1`, [fileId]);
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

export const updateFileTranscode = async (fileId, companyId, { hlsPath, status, error }) => {
  const result = await pool.query(
    `UPDATE files
     SET hls_path = COALESCE($3, hls_path),
         transcode_status = COALESCE($4, transcode_status),
         transcode_error = $5
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [fileId, companyId, hlsPath ?? null, status ?? null, error ?? null]
  );
  return result.rows[0] || null;
};

export const listVideosNeedingHls = async ({ limit = 10, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT *
     FROM files
     WHERE file_type = 'video'
       AND (hls_path IS NULL OR transcode_status IN ('pending', 'failed'))
     ORDER BY id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};
