import pool from "../config/db.js";

// Get all groups (shared across all users)
// The userId parameter is kept for backwards compatibility but is not used.
export const getGroupsByUserId = async (_userId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     GROUP BY dg.id, p.id, p.name
     ORDER BY dg.user_id NULLS FIRST, dg.created_at DESC`
  );
  return result.rows;
};

// Get single group by id (shared across all users)
export const getGroupById = async (groupId, _userId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     WHERE dg.id = $1
     GROUP BY dg.id, p.id, p.name`,
    [groupId]
  );
  return result.rows[0] || null;
};

// Get devices in a group (shared across all users)
export const getDevicesInGroup = async (groupId, _userId) => {
  const result = await pool.query(
    `SELECT d.*, 
            p.name as playlist_name,
            p.status as playlist_status
     FROM devices d
     LEFT JOIN playlists p ON d.active_playlist_id = p.id
     WHERE d.group_id = $1
     ORDER BY d.created_at DESC`,
    [groupId]
  );
  return result.rows;
};

// Create a new group (still records creating user for reference)
export const createGroup = async (name, userId) => {
  const result = await pool.query(
    `INSERT INTO device_groups (name, user_id) 
     VALUES ($1, $2) 
     RETURNING *`,
    [name.trim(), userId]
  );
  return result.rows[0];
};

// Update group name (shared mode: allow any user to update non-global groups)
export const updateGroup = async (groupId, name, _userId) => {
  const result = await pool.query(
    `UPDATE device_groups 
     SET name = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [name.trim(), groupId]
  );
  return result.rows[0] || null;
};

// Delete group and move devices to global "All devices" group (shared mode)
export const deleteGroup = async (groupId, _userId) => {
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
       WHERE group_id = $2`,
      [globalGroupId, groupId]
    );

    // Delete the group
    const deleteResult = await client.query(
      `DELETE FROM device_groups 
       WHERE id = $1
       RETURNING id`,
      [groupId]
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

// Update devices in a group (set membership exactly as specified, shared mode)
export const updateGroupDevices = async (groupId, deviceIds, _userId) => {
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
         AND id != ALL($3::int[])`,
      [globalGroupId, groupId, deviceIds]
    );

    // Then, move all selected devices to this group (only if they belong to the user)
    if (deviceIds.length > 0) {
      await client.query(
        `UPDATE devices 
         SET group_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($2::int[])`,
        [groupId, deviceIds]
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

// Check if group exists and is accessible (shared across all users)
export const canUserAccessGroup = async (groupId, _userId) => {
  const result = await pool.query(
    `SELECT id FROM device_groups 
     WHERE id = $1`,
    [groupId]
  );
  return result.rows.length > 0;
};

