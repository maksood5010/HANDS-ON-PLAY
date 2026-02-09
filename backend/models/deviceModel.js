import pool from "../config/db.js";
import crypto from "crypto";

// Generate a 6-character alphanumeric device key
const generateDeviceKey = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing chars: 0,O,1,I,L
  let key = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
};

export const createDevice = async (name, userId, groupId) => {
  // Generate unique 6-character device key
  const deviceKey = generateDeviceKey();
  
  const result = await pool.query(
    `INSERT INTO devices (name, device_key, user_id, group_id) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [name, deviceKey, userId, groupId]
  );
  return result.rows[0];
};

export const getDevicesByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT d.*, 
            p.name as playlist_name,
            p.status as playlist_status,
            g.id as group_id,
            g.name as group_name,
            (d.last_seen_at IS NOT NULL AND d.last_seen_at > NOW() - INTERVAL '2 minutes') AS is_online,
            CASE WHEN (d.last_seen_at IS NOT NULL AND d.last_seen_at > NOW() - INTERVAL '2 minutes') THEN 'online' ELSE 'offline' END AS status
     FROM devices d
     LEFT JOIN playlists p ON d.active_playlist_id = p.id
     LEFT JOIN device_groups g ON d.group_id = g.id
     WHERE d.user_id = $1
     ORDER BY d.created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getDeviceByKey = async (deviceKey) => {
  const result = await pool.query(
    `SELECT * FROM devices WHERE device_key = $1`,
    [deviceKey]
  );
  return result.rows[0] || null;
};

export const updateDeviceLastSeen = async (deviceKey) => {
  const result = await pool.query(
    `UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_key = $1 RETURNING id`,
    [deviceKey]
  );
  return result.rowCount > 0;
};

export const updateDevicePlaylist = async (deviceId, playlistId, userId) => {
  const result = await pool.query(
    `UPDATE devices 
     SET active_playlist_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [playlistId, deviceId, userId]
  );
  return result.rows[0] || null;
};

export const getDeviceById = async (deviceId, userId) => {
  const result = await pool.query(
    `SELECT d.*, 
            g.id as group_id,
            g.name as group_name
     FROM devices d
     LEFT JOIN device_groups g ON d.group_id = g.id
     WHERE d.id = $1 AND d.user_id = $2`,
    [deviceId, userId]
  );
  return result.rows[0] || null;
};

export const deleteDevice = async (deviceId, userId) => {
  const result = await pool.query(
    `DELETE FROM devices 
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [deviceId, userId]
  );
  return result.rows[0] || null;
};

