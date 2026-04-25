import pool from "../config/db.js";

async function addSchedulePushTrackingFields() {
  try {
    await pool.query(`
      ALTER TABLE playlists
      ADD COLUMN IF NOT EXISTS scheduled_start_push_sent_at TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS scheduled_end_push_sent_at TIMESTAMP DEFAULT NULL;
    `);
    console.log("Added scheduled push tracking fields to playlists table");

    await pool.query(`
      ALTER TABLE playlist_schedules
      ADD COLUMN IF NOT EXISTS last_start_push_sent_for_date DATE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_end_push_sent_for_date DATE DEFAULT NULL;
    `);
    console.log("Added scheduled push tracking fields to playlist_schedules table");
  } catch (error) {
    console.error("Error adding scheduled push tracking fields:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

addSchedulePushTrackingFields();

