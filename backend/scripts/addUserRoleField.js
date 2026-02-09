import pool from "../config/db.js";

async function addUserRoleField() {
  try {
    // 1) Add nullable role column if missing
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20);
    `);
    console.log("Added users.role column (nullable)");

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
  } finally {
    await pool.end();
  }
}

addUserRoleField();

