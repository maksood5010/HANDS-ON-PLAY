import pool from "../config/db.js";

async function addDeviceGroupToPlaylists() {
  try {
    // Add device_group_id column to playlists table
    await pool.query(`
      ALTER TABLE playlists 
      ADD COLUMN IF NOT EXISTS device_group_id INTEGER;
    `);
    console.log("Added device_group_id column to playlists table");

    // Add foreign key constraint if it doesn't exist
    // First check if the constraint already exists
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'playlists' 
      AND constraint_name = 'playlists_device_group_id_fkey';
    `);

    if (constraintCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE playlists 
        ADD CONSTRAINT playlists_device_group_id_fkey 
        FOREIGN KEY (device_group_id) REFERENCES device_groups(id) ON DELETE SET NULL;
      `);
      console.log("Added foreign key constraint for device_group_id");
    } else {
      console.log("Foreign key constraint already exists");
    }

    // Create index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlists_device_group_id ON playlists(device_group_id);
    `);
    console.log("Created index on device_group_id");

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Error adding device_group_id to playlists:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

addDeviceGroupToPlaylists();

