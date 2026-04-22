import pool from "../config/db.js";
import { bootstrapPlatform } from "./lib/bootstrapPlatformCore.js";

/**
 * Bootstraps:
 * - a bootstrap company (if missing)
 * - a platform_super_admin user (if missing)
 *
 * Usage:
 *   node backend/scripts/bootstrapPlatform.js
 *
 * Env:
 *   BOOTSTRAP_COMPANY_NAME="Hands On Innovation"
 *   BOOTSTRAP_COMPANY_SLUG=hands-on-innovation
 *   BOOTSTRAP_SUPERADMIN_USERNAME=admin
 *   BOOTSTRAP_SUPERADMIN_PASSWORD=admin123
 */
async function bootstrap() {
  try {
    await bootstrapPlatform({ pool });
  } catch (error) {
    console.error("Bootstrap failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

bootstrap();

