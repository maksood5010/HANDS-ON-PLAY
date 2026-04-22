import pool from "../config/db.js";

export const addItemToPlaylist = async (companyId, playlistId, fileId, duration, displayOrder) => {
  const result = await pool.query(
    `INSERT INTO playlist_items (company_id, playlist_id, file_id, duration, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [companyId, playlistId, fileId, duration || 5, displayOrder]
  );
  return result.rows[0];
};

export const getPlaylistItems = async (playlistId, companyId) => {
  const result = await pool.query(
    `SELECT 
      pi.id,
      pi.playlist_id,
      pi.file_id,
      pi.duration,
      pi.display_order,
      f.original_name,
      f.stored_name,
      f.file_path,
      f.file_type,
      f.mime_type,
      f.file_size
     FROM playlist_items pi
     INNER JOIN files f ON pi.file_id = f.id
     WHERE pi.playlist_id = $1 AND pi.company_id = $2
     ORDER BY pi.display_order ASC`,
    [playlistId, companyId]
  );
  return result.rows;
};

export const getPlaylistWithItems = async (playlistId, companyId) => {
  const playlistResult = await pool.query(
    `SELECT p.*, dg.name AS device_group_name
     FROM playlists p
     LEFT JOIN device_groups dg ON p.device_group_id = dg.id
     WHERE p.id = $1 AND p.company_id = $2`,
    [playlistId, companyId]
  );
  
  if (playlistResult.rows.length === 0) {
    return null;
  }

  const playlist = playlistResult.rows[0];

  // Get playlist items with file details
  const itemsResult = await pool.query(
    `SELECT 
      pi.id,
      pi.file_id,
      pi.duration,
      pi.display_order,
      f.original_name,
      f.stored_name,
      f.file_path,
      f.file_type,
      f.mime_type,
      f.file_size
     FROM playlist_items pi
     INNER JOIN files f ON pi.file_id = f.id
     WHERE pi.playlist_id = $1 AND pi.company_id = $2
     ORDER BY pi.display_order ASC`,
    [playlistId, companyId]
  );

  return {
    ...playlist,
    items: itemsResult.rows
  };
};

export const updateItemDuration = async (itemId, companyId, duration) => {
  const result = await pool.query(
    `UPDATE playlist_items
     SET duration = $1
     WHERE id = $2 AND company_id = $3
     RETURNING *`,
    [duration, itemId, companyId]
  );
  return result.rows[0] || null;
};

export const getItemById = async (itemId, companyId) => {
  const result = await pool.query(
    `SELECT *
     FROM playlist_items
     WHERE id = $1 AND company_id = $2`,
    [itemId, companyId]
  );
  return result.rows[0] || null;
};

export const getItemByOrder = async (playlistId, companyId, displayOrder) => {
  const result = await pool.query(
    `SELECT * FROM playlist_items
     WHERE playlist_id = $1 AND company_id = $2 AND display_order = $3`,
    [playlistId, companyId, displayOrder]
  );
  return result.rows[0] || null;
};

export const swapItemOrder = async (itemId, companyId, direction) => {
  // Get current item
  const currentItem = await getItemById(itemId, companyId);
  if (!currentItem) {
    return null;
  }

  const playlistId = currentItem.playlist_id;
  const currentOrder = currentItem.display_order;
  
  // Calculate target order (up = -1, down = +1)
  const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
  
  // Check if target order is valid (must be >= 1)
  if (targetOrder < 1) {
    return null;
  }

  // Get item at target position
  const targetItem = await getItemByOrder(playlistId, companyId, targetOrder);
  
  // If no item at target position, we can't swap (shouldn't happen in normal flow)
  if (!targetItem) {
    return null;
  }
  
  // Use a transaction to swap orders
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Use temporary negative values to avoid unique constraint violation
    const tempOrder1 = -currentOrder;
    const tempOrder2 = -targetOrder;
    
    // Set both to temporary values
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2 AND company_id = $3`,
      [tempOrder1, itemId, companyId]
    );
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2 AND company_id = $3`,
      [tempOrder2, targetItem.id, companyId]
    );
    
    // Now swap to final positions
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2 AND company_id = $3`,
      [targetOrder, itemId, companyId]
    );
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2 AND company_id = $3`,
      [currentOrder, targetItem.id, companyId]
    );
    
    await client.query('COMMIT');
    
    // Return updated item
    const result = await pool.query(
      `SELECT * FROM playlist_items WHERE id = $1 AND company_id = $2`,
      [itemId, companyId]
    );
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateItemOrder = async (itemId, companyId, newOrder) => {
  // Kept for backward compatibility; uses swapItemOrder step-by-step.
  const currentItem = await getItemById(itemId, companyId);
  if (!currentItem) {
    return null;
  }

  const currentOrder = currentItem.display_order;
  const direction = newOrder < currentOrder ? 'up' : 'down';
  
  // Calculate how many positions to move
  const steps = Math.abs(newOrder - currentOrder);
  
  // Swap step by step
  let result = currentItem;
  for (let i = 0; i < steps; i++) {
    result = await swapItemOrder(itemId, companyId, direction);
    if (!result) break;
  }
  
  return result;
};

export const deleteItem = async (itemId, companyId) => {
  const result = await pool.query(
    `DELETE FROM playlist_items
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [itemId, companyId]
  );
  return result.rows[0] || null;
};

export const getNextDisplayOrder = async (playlistId, companyId) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
     FROM playlist_items
     WHERE playlist_id = $1 AND company_id = $2`,
    [playlistId, companyId]
  );
  return result.rows[0].next_order;
};

