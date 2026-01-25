import pool from "../config/db.js";

// Get all groups (global + user's groups)
export const getGroupsByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id AND d.user_id = $1
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     WHERE dg.user_id IS NULL OR dg.user_id = $1
     GROUP BY dg.id, p.id, p.name
     ORDER BY dg.user_id NULLS FIRST, dg.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Get single group by id
export const getGroupById = async (groupId, userId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id AND d.user_id = $2
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     WHERE dg.id = $1 AND (dg.user_id IS NULL OR dg.user_id = $2)
     GROUP BY dg.id, p.id, p.name`,
    [groupId, userId]
  );
  return result.rows[0] || null;
};

// Get devices in a group
export const getDevicesInGroup = async (groupId, userId) => {
  const result = await pool.query(
    `SELECT d.*, 
            p.name as playlist_name,
            p.status as playlist_status
     FROM devices d
     LEFT JOIN playlists p ON d.active_playlist_id = p.id
     WHERE d.group_id = $1 AND d.user_id = $2
     ORDER BY d.created_at DESC`,
    [groupId, userId]
  );
  return result.rows;
};

// Create a new group
export const createGroup = async (name, userId) => {
  const result = await pool.query(
    `INSERT INTO device_groups (name, user_id) 
     VALUES ($1, $2) 
     RETURNING *`,
    [name.trim(), userId]
  );
  return result.rows[0];
};

// Update group name
export const updateGroup = async (groupId, name, userId) => {
  const result = await pool.query(
    `UPDATE device_groups 
     SET name = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [name.trim(), groupId, userId]
  );
  return result.rows[0] || null;
};

// Delete group and move devices to global "All devices" group
export const deleteGroup = async (groupId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the global "All devices" group id
    const globalGroupResult = await client.query(
      `SELECT id FROM device_groups WHERE name = 'All devices' AND user_id IS NULL LIMIT 1`
    );
    
    if (globalGroupResult.rows.length === 0) {
      throw new Error('Global "All devices" group not found');
    }
    
    const globalGroupId = globalGroupResult.rows[0].id;

    // Move all devices in this group to the global group
    await client.query(
      `UPDATE devices 
       SET group_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $2 AND user_id = $3`,
      [globalGroupId, groupId, userId]
    );

    // Delete the group
    const deleteResult = await client.query(
      `DELETE FROM device_groups 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [groupId, userId]
    );

    await client.query('COMMIT');
    return deleteResult.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Update devices in a group (set membership exactly as specified)
export const updateGroupDevices = async (groupId, deviceIds, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the global "All devices" group id
    const globalGroupResult = await client.query(
      `SELECT id FROM device_groups WHERE name = 'All devices' AND user_id IS NULL LIMIT 1`
    );
    
    if (globalGroupResult.rows.length === 0) {
      throw new Error('Global "All devices" group not found');
    }
    
    const globalGroupId = globalGroupResult.rows[0].id;

    // First, move all devices that were in this group but are not in the new list to "All devices"
    const deviceIdsArray = deviceIds.length > 0 ? deviceIds : [-1]; // Use -1 to ensure no matches if empty
    await client.query(
      `UPDATE devices 
       SET group_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $2 
         AND user_id = $3 
         AND id != ALL($4::int[])`,
      [globalGroupId, groupId, userId, deviceIds]
    );

    // Then, move all selected devices to this group (only if they belong to the user)
    if (deviceIds.length > 0) {
      await client.query(
        `UPDATE devices 
         SET group_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($2::int[]) AND user_id = $3`,
        [groupId, deviceIds, userId]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Check if group belongs to user or is global
export const canUserAccessGroup = async (groupId, userId) => {
  const result = await pool.query(
    `SELECT id FROM device_groups 
     WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [groupId, userId]
  );
  return result.rows.length > 0;
};

