import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { userExists, createUser } from "../models/userModel.js";
import { bootstrapPlatform } from "./lib/bootstrapPlatformCore.js";

const USER_ROLES = ["platform_super_admin", "company_admin", "company_user"];

async function createCompaniesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        purchase_date DATE NOT NULL,
        payment_cycle VARCHAR(16) NOT NULL,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        device_limit INTEGER NOT NULL DEFAULT 0,
        additional_info TEXT,
        logo_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Companies table created successfully!");

    // Add logo_path column (idempotent) in case table existed before
    await pool.query(`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500);
    `);

    // Enforce allowed payment cycles (idempotent)
    const chkExists = await pool.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chk_companies_payment_cycle'
        AND conrelid = 'companies'::regclass;
    `);
    if (chkExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE companies
        ADD CONSTRAINT chk_companies_payment_cycle
        CHECK (payment_cycle IN ('monthly', 'yearly', 'one_time'));
      `);
    }
  } catch (error) {
    console.error("Error creating companies table:", error);
    throw error;
  }
}

async function createUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'company_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Users table created successfully!");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
    `);

    // Add role constraint (idempotent) in case table existed before role/check were introduced
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
        CHECK (role IN ('${USER_ROLES.join("','")}'));
      `);
      console.log("Added CHECK constraint chk_users_role");
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
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log("Playlists table created successfully!");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlists_company_id ON playlists(company_id);
    `);

    // Create files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_files_company_id ON files(company_id);
    `);

    // Create playlist_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_playlist_items_company_id ON playlist_items(company_id);
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
    console.log("Indexes for device_groups created successfully!");

    // Add group_id column to devices table (nullable first)
    await pool.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS group_id INTEGER;
    `);
    console.log("Added group_id column to devices table");

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

async function createPlaylistSchedulesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_schedules (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        device_group_id INTEGER NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (type IN ('daily')),
        daily_start_time TIME NOT NULL,
        daily_end_time TIME NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Playlist schedules table created successfully!");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_schedules_company_group_enabled
      ON playlist_schedules(company_id, device_group_id, enabled);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_schedules_company_playlist
      ON playlist_schedules(company_id, playlist_id);
    `);
    console.log("Indexes for playlist_schedules created successfully!");
  } catch (error) {
    console.error("Error creating playlist_schedules table:", error);
    throw error;
  }
}

async function addSchedulePushTrackingFields() {
  try {
    // One-time scheduled playlists: track whether we already pushed at schedule_start/schedule_end.
    await pool.query(`
      ALTER TABLE playlists
      ADD COLUMN IF NOT EXISTS scheduled_start_push_sent_at TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS scheduled_end_push_sent_at TIMESTAMP DEFAULT NULL;
    `);
    console.log("Added scheduled push tracking fields to playlists table");

    // Daily repeating schedules: track whether we already pushed for today.
    await pool.query(`
      ALTER TABLE playlist_schedules
      ADD COLUMN IF NOT EXISTS last_start_push_sent_for_date DATE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_end_push_sent_for_date DATE DEFAULT NULL;
    `);
    console.log("Added scheduled push tracking fields to playlist_schedules table");
  } catch (error) {
    console.error("Error adding scheduled push tracking fields:", error);
    throw error;
  }
}

async function addUserRoleField() {
  try {
    // Legacy no-op: roles are now created directly on users table creation.
    return;
  } catch (error) {
    console.error("Error adding role field:", error);
    throw error;
  }
}

async function setupDatabase() {
  try {
    console.log("Starting database setup...");
    await createCompaniesTable();
    await createUsersTable();
    await createPlaylistTables();
    await addPlaylistStatusFields();
    await createDeviceGroupsTable();
    await addDeviceGroupToPlaylists();
    await addDeviceLastSeen();
    await createPlaylistSchedulesTable();
    await addSchedulePushTrackingFields();
    await addUserRoleField();
    await bootstrapPlatform({ pool });
    console.log("Database setup completed successfully.");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();

