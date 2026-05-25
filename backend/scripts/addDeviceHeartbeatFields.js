import pool from "../config/db.js";

async function addDeviceHeartbeatFields() {
  try {
    await pool.query(`
      ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS heartbeat_currently_playing TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS heartbeat_app_version VARCHAR(32) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS heartbeat_playback_state VARCHAR(32) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS heartbeat_health_status VARCHAR(32) DEFAULT NULL;
    `);
    console.log("Added device heartbeat columns");
  } catch (error) {
    console.error("Error adding device heartbeat columns:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

addDeviceHeartbeatFields();
