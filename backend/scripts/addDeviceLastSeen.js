import pool from "../config/db.js";

async function addDeviceLastSeen() {
  try {
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NULL;
    `);
    console.log("Added last_seen_at column to devices table");
  } catch (error) {
    console.error("Error adding last_seen_at to devices:", error);
  } finally {
    await pool.end();
  }
}

addDeviceLastSeen();
