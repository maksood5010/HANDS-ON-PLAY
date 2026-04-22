import pool from "../config/db.js";

async function createDeviceGroupsTable() {
  try {
    // Create device_groups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_groups (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(company_id, name)
      );
    `);
    console.log("Device groups table created successfully!");

    // Create index for user_id lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_groups_user_id ON device_groups(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_groups_company_id ON device_groups(company_id);
    `);
    console.log("Indexes created successfully!");

    // Add group_id column to devices table (nullable first)
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS group_id INTEGER;
    `);
    console.log("Added group_id column to devices table");

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

