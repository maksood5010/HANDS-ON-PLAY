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
  } finally {
    await pool.end();
  }
}

createUsersTable();

