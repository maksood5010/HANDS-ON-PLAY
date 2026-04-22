import pool from "../config/db.js";

const ALL_DEVICES_GROUP_NAME = "All devices";

export const ensureAllDevicesGroup = async (companyId, client = pool) => {
  const result = await client.query(
    `
    INSERT INTO device_groups (company_id, name, user_id)
    SELECT $1, $2::text, NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM device_groups WHERE company_id = $1 AND name = $2::text
    )
    RETURNING id
    `,
    [companyId, ALL_DEVICES_GROUP_NAME]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const existing = await client.query(
    `SELECT id FROM device_groups WHERE company_id = $1 AND name = $2::text LIMIT 1`,
    [companyId, ALL_DEVICES_GROUP_NAME]
  );
  return existing.rows[0]?.id ?? null;
};

const isAllDevicesGroupRow = (groupRow) =>
  !!groupRow &&
  groupRow.user_id === null &&
  typeof groupRow.name === "string" &&
  groupRow.name.trim() === ALL_DEVICES_GROUP_NAME;

export const getGroupsByCompanyId = async (companyId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     WHERE dg.company_id = $1
     GROUP BY dg.id, p.id, p.name
     ORDER BY dg.created_at DESC`,
    [companyId]
  );

  const groups = result.rows;
  const allDevices = groups.find((g) => isAllDevicesGroupRow(g));
  if (!allDevices) return groups;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM devices WHERE company_id = $1`,
    [companyId]
  );
  allDevices.device_count = countRes.rows[0]?.count ?? 0;
  return groups;
};

export const getGroupById = async (groupId, companyId) => {
  const result = await pool.query(
    `SELECT dg.*, 
            COUNT(DISTINCT d.id) as device_count,
            p.id as active_playlist_id,
            p.name as active_playlist_name
     FROM device_groups dg
     LEFT JOIN devices d ON dg.id = d.group_id
     LEFT JOIN playlists p ON p.device_group_id = dg.id AND p.status = 'active'
     WHERE dg.id = $1 AND dg.company_id = $2
     GROUP BY dg.id, p.id, p.name`,
    [groupId, companyId]
  );
  return result.rows[0] || null;
};

export const getDevicesInGroup = async (groupId, companyId) => {
  const groupRes = await pool.query(
    `SELECT id, name, user_id FROM device_groups WHERE id = $1 AND company_id = $2`,
    [groupId, companyId]
  );
  const group = groupRes.rows[0] || null;
  if (!group) return [];

  if (isAllDevicesGroupRow(group)) {
    const result = await pool.query(
      `SELECT d.*, 
              p.name as playlist_name,
              p.status as playlist_status
       FROM devices d
       LEFT JOIN playlists p ON d.active_playlist_id = p.id
       WHERE d.company_id = $1
       ORDER BY d.created_at DESC`,
      [companyId]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT d.*, 
            p.name as playlist_name,
            p.status as playlist_status
     FROM devices d
     LEFT JOIN playlists p ON d.active_playlist_id = p.id
     WHERE d.group_id = $1 AND d.company_id = $2
     ORDER BY d.created_at DESC`,
    [groupId, companyId]
  );
  return result.rows;
};

export const createGroup = async (companyId, name, userId) => {
  const result = await pool.query(
    `INSERT INTO device_groups (company_id, name, user_id) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [companyId, name.trim(), userId]
  );
  return result.rows[0];
};

export const updateGroup = async (groupId, companyId, name) => {
  const result = await pool.query(
    `UPDATE device_groups 
     SET name = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND company_id = $3
     RETURNING *`,
    [name.trim(), groupId, companyId]
  );
  return result.rows[0] || null;
};

export const deleteGroup = async (groupId, companyId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allDevicesGroupId = await ensureAllDevicesGroup(companyId);
    if (!allDevicesGroupId) throw new Error("All devices group not found");

    // Move all devices in this group to the global group
    await client.query(
      `UPDATE devices 
       SET group_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE group_id = $2 AND company_id = $3`,
      [allDevicesGroupId, groupId, companyId]
    );

    // Delete the group
    const deleteResult = await client.query(
      `DELETE FROM device_groups 
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [groupId, companyId]
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

export const updateGroupDevices = async (groupId, companyId, deviceIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allDevicesGroupId = await ensureAllDevicesGroup(companyId);
    if (!allDevicesGroupId) throw new Error("All devices group not found");

    // First, move all devices that were in this group but are not in the new list to "All devices"
    const deviceIdsArray = deviceIds.length > 0 ? deviceIds : [-1]; // Use -1 to ensure no matches if empty
    await client.query(
      `UPDATE devices 
       SET group_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $2
         AND group_id = $3 
         AND id != ALL($4::int[])`,
      [allDevicesGroupId, companyId, groupId, deviceIdsArray]
    );

    // Then, move all selected devices to this group (only if they belong to the user)
    if (deviceIds.length > 0) {
      await client.query(
        `UPDATE devices 
         SET group_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE company_id = $2 AND id = ANY($3::int[])`,
        [groupId, companyId, deviceIds]
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

export const canUserAccessGroup = async (groupId, companyId) => {
  const result = await pool.query(
    `SELECT id FROM device_groups 
     WHERE id = $1 AND company_id = $2`,
    [groupId, companyId]
  );
  return result.rows.length > 0;
};

