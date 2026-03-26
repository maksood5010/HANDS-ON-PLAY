import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { userExists, createUser } from "../models/userModel.js";

async function createUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'Admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Users table created successfully!");

    // Add constraint (idempotent) in case table existed before role/check were introduced
    const constraintExists = await pool.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_users_role'
        AND conrelid = 'users'::regclass;
    `);
    if (constraintExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users
        ADD CONSTRAINT chk_users_role
        CHECK (role IN ('Admin', 'Customer'));
      `);
      console.log("Added CHECK constraint chk_users_role");
    }

    // Create a default user for testing (username: admin, password: admin123)
    const defaultUsername = "admin";
    const defaultPassword = "admin123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Check if user already exists
    const exists = await userExists(defaultUsername);

    if (!exists) {
      await createUser(defaultUsername, hashedPassword, "Admin");
      console.log(`Default user created: ${defaultUsername} / ${defaultPassword}`);
    } else {
      console.log("Default user already exists");
    }
  } catch (error) {
    console.error("Error creating users table:", error);
    throw error;
  }
}

async function createPlaylistTables() {
  try {
    // Create playlists table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Playlists table created successfully!");

    // Create files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100),
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Files table created successfully!");

    // Create playlist_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        duration INTEGER DEFAULT 5,
        display_order INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE(playlist_id, display_order)
      );
    `);
    console.log("Playlist items table created successfully!");

    // Create index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_display_order ON playlist_items(playlist_id, display_order);
    `);
    console.log("Indexes for playlist_items created successfully!");
  } catch (error) {
    console.error("Error creating playlist tables:", error);
    throw error;
  }
}

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

    // Create devices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
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
    console.log("Indexes for devices created successfully!");
  } catch (error) {
    console.error("Error adding playlist status fields:", error);
    throw error;
  }
}

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
    console.log("Indexes for device_groups created successfully!");

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
    const backfillResult = await pool.query(
      `
      UPDATE devices 
      SET group_id = $1 
      WHERE group_id IS NULL;
    `,
      [globalGroupId]
    );
    console.log(`Backfilled ${backfillResult.rowCount} devices with global group`);

    // Now make group_id NOT NULL
    await pool.query(`
      ALTER TABLE devices 
      ALTER COLUMN group_id SET NOT NULL;
    `);
    console.log("Made group_id NOT NULL");

    // Add foreign key constraint if missing
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
      console.log("Foreign key constraint on devices.group_id already exists");
    }

    // Create index for group_id lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
    `);
    console.log("Index on devices.group_id created successfully!");
  } catch (error) {
    console.error("Error creating device groups table:", error);
    throw error;
  }
}

async function addDeviceGroupToPlaylists() {
  try {
    // Add device_group_id column to playlists table
    await pool.query(`
      ALTER TABLE playlists 
      ADD COLUMN IF NOT EXISTS device_group_id INTEGER;
    `);
    console.log("Added device_group_id column to playlists table");

    // Add foreign key constraint if it doesn't exist
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
      console.log("Foreign key constraint for device_group_id already exists");
    }

    // Create index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlists_device_group_id ON playlists(device_group_id);
    `);
    console.log("Created index on device_group_id");
  } catch (error) {
    console.error("Error adding device_group_id to playlists:", error);
    throw error;
  }
}

async function addDeviceLastSeen() {
  try {
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NULL;
    `);
    console.log("Added last_seen_at column to devices table");
  } catch (error) {
    console.error("Error adding last_seen_at to devices:", error);
    throw error;
  }
}

async function addUserRoleField() {
  try {
    // 1) Add nullable role column if missing
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20);
    `);
    console.log("Ensured users.role column exists (nullable)");

    // 2) Backfill existing rows
    const backfill = await pool.query(`
      UPDATE users
      SET role = 'Admin'
      WHERE role IS NULL;
    `);
    console.log(`Backfilled ${backfill.rowCount} users with role=Admin`);

    // 3) Make it NOT NULL with default
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role SET DEFAULT 'Admin';
    `);
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role SET NOT NULL;
    `);
    console.log("Set users.role DEFAULT 'Admin' and NOT NULL");

    // 4) Add constraint (idempotent)
    const constraintExists = await pool.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_users_role'
        AND conrelid = 'users'::regclass;
    `);

    if (constraintExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users
        ADD CONSTRAINT chk_users_role
        CHECK (role IN ('Admin', 'Customer'));
      `);
      console.log("Added CHECK constraint chk_users_role");
    } else {
      console.log("CHECK constraint chk_users_role already exists");
    }
  } catch (error) {
    console.error("Error adding role field:", error);
    throw error;
  }
}

async function setupDatabase() {
  try {
    console.log("Starting database setup...");
    await createUsersTable();
    await createPlaylistTables();
    await addPlaylistStatusFields();
    await createDeviceGroupsTable();
    await addDeviceGroupToPlaylists();
    await addDeviceLastSeen();
    await addUserRoleField();
    console.log("Database setup completed successfully.");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();

