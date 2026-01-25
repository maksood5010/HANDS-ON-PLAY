import pool from "../config/db.js";

export const addItemToPlaylist = async (playlistId, fileId, duration, displayOrder) => {
  const result = await pool.query(
    `INSERT INTO playlist_items (playlist_id, file_id, duration, display_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [playlistId, fileId, duration || 5, displayOrder]
  );
  return result.rows[0];
};

export const getPlaylistItems = async (playlistId, userId) => {
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
     INNER JOIN playlists p ON pi.playlist_id = p.id
     WHERE pi.playlist_id = $1 AND p.user_id = $2
     ORDER BY pi.display_order ASC`,
    [playlistId, userId]
  );
  return result.rows;
};

export const getPlaylistWithItems = async (playlistId, userId) => {
  // Get playlist - userId can be null for public access
  let playlistResult;
  if (userId) {
    playlistResult = await pool.query(
      `SELECT * FROM playlists 
       WHERE id = $1 AND user_id = $2`,
      [playlistId, userId]
    );
  } else {
    playlistResult = await pool.query(
      `SELECT * FROM playlists 
       WHERE id = $1`,
      [playlistId]
    );
  }
  
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
     WHERE pi.playlist_id = $1
     ORDER BY pi.display_order ASC`,
    [playlistId]
  );

  return {
    ...playlist,
    items: itemsResult.rows
  };
};

export const updateItemDuration = async (itemId, duration, userId) => {
  const result = await pool.query(
    `UPDATE playlist_items pi
     SET duration = $1
     FROM playlists p
     WHERE pi.id = $2 AND pi.playlist_id = p.id AND p.user_id = $3
     RETURNING pi.*`,
    [duration, itemId, userId]
  );
  return result.rows[0] || null;
};

export const getItemById = async (itemId, userId) => {
  const result = await pool.query(
    `SELECT pi.*
     FROM playlist_items pi
     INNER JOIN playlists p ON pi.playlist_id = p.id
     WHERE pi.id = $1 AND p.user_id = $2`,
    [itemId, userId]
  );
  return result.rows[0] || null;
};

export const getItemByOrder = async (playlistId, displayOrder) => {
  const result = await pool.query(
    `SELECT * FROM playlist_items
     WHERE playlist_id = $1 AND display_order = $2`,
    [playlistId, displayOrder]
  );
  return result.rows[0] || null;
};

export const swapItemOrder = async (itemId, direction, userId) => {
  // Get current item
  const currentItem = await getItemById(itemId, userId);
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
  const targetItem = await getItemByOrder(playlistId, targetOrder);
  
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
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2`,
      [tempOrder1, itemId]
    );
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2`,
      [tempOrder2, targetItem.id]
    );
    
    // Now swap to final positions
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2`,
      [targetOrder, itemId]
    );
    await client.query(
      `UPDATE playlist_items SET display_order = $1 WHERE id = $2`,
      [currentOrder, targetItem.id]
    );
    
    await client.query('COMMIT');
    
    // Return updated item
    const result = await pool.query(
      `SELECT * FROM playlist_items WHERE id = $1`,
      [itemId]
    );
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateItemOrder = async (itemId, newOrder, userId) => {
  // This function is kept for backward compatibility but should use swapItemOrder instead
  const currentItem = await getItemById(itemId, userId);
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
    result = await swapItemOrder(itemId, direction, userId);
    if (!result) break;
  }
  
  return result;
};

export const deleteItem = async (itemId, userId) => {
  const result = await pool.query(
    `DELETE FROM playlist_items pi
     USING playlists p
     WHERE pi.id = $1 AND pi.playlist_id = p.id AND p.user_id = $2
     RETURNING pi.*`,
    [itemId, userId]
  );
  return result.rows[0] || null;
};

export const getNextDisplayOrder = async (playlistId) => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
     FROM playlist_items
     WHERE playlist_id = $1`,
    [playlistId]
  );
  return result.rows[0].next_order;
};

