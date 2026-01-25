import pool from "../config/db.js";

async function createDeviceGroupsTable() {
  try {
    // Create device_groups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );
    `);
    console.log("Device groups table created successfully!");

    // Create index for user_id lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_groups_user_id ON device_groups(user_id);
    `);
    console.log("Indexes created successfully!");

    // Insert global "All devices" group if it doesn't exist
    const globalGroupResult = await pool.query(`
      INSERT INTO device_groups (name, user_id)
      SELECT 'All devices', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM device_groups WHERE name = 'All devices' AND user_id IS NULL
      )
      RETURNING id;
    `);
    
    let globalGroupId;
    if (globalGroupResult.rows.length > 0) {
      globalGroupId = globalGroupResult.rows[0].id;
      console.log("Global 'All devices' group created with id:", globalGroupId);
    } else {
      // Get existing global group id
      const existingGroup = await pool.query(`
        SELECT id FROM device_groups WHERE name = 'All devices' AND user_id IS NULL LIMIT 1;
      `);
      globalGroupId = existingGroup.rows[0].id;
      console.log("Global 'All devices' group already exists with id:", globalGroupId);
    }

    // Add group_id column to devices table (nullable first)
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS group_id INTEGER;
    `);
    console.log("Added group_id column to devices table");

    // Backfill: set all devices without a group to the global "All devices" group
    const backfillResult = await pool.query(`
      UPDATE devices 
      SET group_id = $1 
      WHERE group_id IS NULL;
    `, [globalGroupId]);
    console.log(`Backfilled ${backfillResult.rowCount} devices with global group`);

    // Now make group_id NOT NULL
    await pool.query(`
      ALTER TABLE devices 
      ALTER COLUMN group_id SET NOT NULL;
    `);
    console.log("Made group_id NOT NULL");

        // Add foreign key constraint
        const constraintExists = await pool.query(`
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'fk_devices_group_id' 
          AND conrelid = 'devices'::regclass;
        `);
        
        if (constraintExists.rows.length === 0) {
          await pool.query(`
            ALTER TABLE devices 
            ADD CONSTRAINT fk_devices_group_id 
            FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE RESTRICT;
          `);
          console.log("Added foreign key constraint on devices.group_id");
        } else {
          console.log("Foreign key constraint already exists");
        }

    // Create index for group_id lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
    `);
    console.log("Index on devices.group_id created successfully!");

  } catch (error) {
    console.error("Error creating device groups table:", error);
  } finally {
    await pool.end();
  }
}

createDeviceGroupsTable();

