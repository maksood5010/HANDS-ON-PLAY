import pool from "../config/db.js";

export const createPlaylist = async (name, description, userId) => {
  const result = await pool.query(
    `INSERT INTO playlists (name, description, user_id, status) 
     VALUES ($1, $2, $3, 'inactive') 
     RETURNING id, name, description, user_id, status, schedule_start, schedule_end, created_at, updated_at`,
    [name, description || null, userId]
  );
  return result.rows[0];
};

export const getPlaylistsByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT p.*, 
            COUNT(pi.id) as item_count,
            dg.id as device_group_id,
            dg.name as device_group_name
     FROM playlists p
     LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
     LEFT JOIN device_groups dg ON p.device_group_id = dg.id
     WHERE p.user_id = $1
     GROUP BY p.id, dg.id, dg.name
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getPlaylistById = async (playlistId, userId) => {
  const result = await pool.query(
    `SELECT * FROM playlists 
     WHERE id = $1 AND user_id = $2`,
    [playlistId, userId]
  );
  return result.rows[0] || null;
};

export const updatePlaylist = async (playlistId, name, description, userId) => {
  const result = await pool.query(
    `UPDATE playlists 
     SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [name, description || null, playlistId, userId]
  );
  return result.rows[0] || null;
};

export const updatePlaylistStatus = async (playlistId, status, userId, deviceGroupId = null) => {
  // If status is 'inactive', clear device_group_id
  const finalDeviceGroupId = status === 'inactive' ? null : deviceGroupId;
  
  const result = await pool.query(
    `UPDATE playlists 
     SET status = $1, device_group_id = $4, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [status, playlistId, userId, finalDeviceGroupId]
  );
  return result.rows[0] || null;
};

export const schedulePlaylist = async (playlistId, startTime, endTime, userId, deviceGroupId = null) => {
  const result = await pool.query(
    `UPDATE playlists 
     SET status = 'scheduled', schedule_start = $1, schedule_end = $2, device_group_id = $5, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [startTime, endTime, playlistId, userId, deviceGroupId]
  );
  return result.rows[0] || null;
};

export const getActivePlaylist = async (deviceGroupId = null) => {
  const now = new Date();
  
  // Build query with optional device group filter
  let query;
  let params;
  
  if (deviceGroupId) {
    query = `SELECT * FROM playlists 
             WHERE (status = 'active' OR status = 'scheduled')
             AND device_group_id = $1
             ORDER BY 
               CASE WHEN status = 'active' THEN 1 ELSE 2 END,
               created_at DESC
             LIMIT 1`;
    params = [deviceGroupId];
  } else {
    query = `SELECT * FROM playlists 
             WHERE status = 'active' OR status = 'scheduled'
             ORDER BY 
               CASE WHEN status = 'active' THEN 1 ELSE 2 END,
               created_at DESC
             LIMIT 1`;
    params = [];
  }
  
  const playlistsResult = await pool.query(query, params);
  
  if (playlistsResult.rows.length === 0) {
    return null;
  }
  
  const playlist = playlistsResult.rows[0];
  
  // If scheduled, check if within time range
  if (playlist.status === 'scheduled') {
    const startTime = new Date(playlist.schedule_start);
    const endTime = playlist.schedule_end ? new Date(playlist.schedule_end) : null;
    
    if (now >= startTime && (!endTime || now <= endTime)) {
      return playlist;
    }
    return null;
  }
  
  // If active, return it
  if (playlist.status === 'active') {
    return playlist;
  }
  
  return null;
};

export const deletePlaylist = async (playlistId, userId) => {
  const result = await pool.query(
    `DELETE FROM playlists 
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [playlistId, userId]
  );
  return result.rows[0] || null;
};

