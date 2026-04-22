import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { userExists, createUser } from "../models/userModel.js";

async function createUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Companies table created successfully!");

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
        CHECK (role IN ('platform_super_admin', 'company_admin', 'company_user'));
      `);
      console.log("Added CHECK constraint chk_users_role");
    }

    // Note: no default user is created here anymore; companies/users are bootstrapped separately.

  } catch (error) {
    console.error("Error creating users table:", error);
  } finally {
    await pool.end();
  }
}

createUsersTable();

