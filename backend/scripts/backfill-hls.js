#!/usr/bin/env node
/**
 * Backfill HLS for existing video files (one batch per run).
 *
 * Usage:
 *   node scripts/backfill-hls.js
 *   HLS_BACKFILL_BATCH=5 node scripts/backfill-hls.js
 *
 * Run on the droplet after migration and with ffmpeg installed.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import { listVideosNeedingHls } from "../models/fileModel.js";
import { transcodeVideoFile } from "../services/transcode/hlsTranscode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const batchSize = Math.max(
  1,
  parseInt(process.env.HLS_BACKFILL_BATCH || "3", 10) || 3
);

async function main() {
  const rows = await listVideosNeedingHls({ limit: batchSize, offset: 0 });

  if (!rows.length) {
    console.log("No videos need HLS backfill.");
    await pool.end();
    return;
  }

  console.log(`Processing ${rows.length} video(s)...`);

  let ok = 0;
  let failed = 0;

  for (const file of rows) {
    try {
      console.log(`Transcoding file id=${file.id} path=${file.file_path}`);
      await transcodeVideoFile(file);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`Failed file id=${file.id}:`, err?.message || err);
    }
  }

  console.log(`Done. success=${ok} failed=${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
