import pool from "../config/db.js";

async function addPlaylistStatusFields() {
  try {
    // Add status field to playlists table
    await pool.query(`
      ALTER TABLE playlists 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'scheduled'));
    `);
    console.log("Added status field to playlists table");

    // Add scheduling fields
    await pool.query(`
      ALTER TABLE playlists 
      ADD COLUMN IF NOT EXISTS schedule_start TIMESTAMP,
      ADD COLUMN IF NOT EXISTS schedule_end TIMESTAMP;
    `);
    console.log("Added scheduling fields to playlists table");

    // Track whether we already sent a refresh push for schedule windows.
    await pool.query(`
      ALTER TABLE playlists
      ADD COLUMN IF NOT EXISTS scheduled_start_push_sent_at TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS scheduled_end_push_sent_at TIMESTAMP DEFAULT NULL;
    `);
    console.log("Added scheduled push tracking fields to playlists table");

    // Create devices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        device_key VARCHAR(100) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        active_playlist_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (active_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
      );
    `);
    console.log("Devices table created successfully!");

    // Create index for device_key
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_device_key ON devices(device_key);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_company_id ON devices(company_id);
    `);
    console.log("Indexes created successfully!");

  } catch (error) {
    console.error("Error adding playlist status fields:", error);
  } finally {
    await pool.end();
  }
}

addPlaylistStatusFields();

