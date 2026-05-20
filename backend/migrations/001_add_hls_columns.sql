-- HLS adaptive playback: store manifest path and transcode state per file.
-- Run once: npm run db:migrate (from backend/)

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS hls_path TEXT,
  ADD COLUMN IF NOT EXISTS transcode_status VARCHAR(20) NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS transcode_error TEXT;

-- Existing videos uploaded before this migration should be backfilled.
UPDATE files
SET transcode_status = 'pending'
WHERE file_type = 'video'
  AND (transcode_status IS NULL OR transcode_status = 'skipped')
  AND hls_path IS NULL;

COMMENT ON COLUMN files.hls_path IS 'Storage key for master.m3u8 (e.g. companies/acme/media/hls/123/master.m3u8)';
COMMENT ON COLUMN files.transcode_status IS 'pending | ready | failed | skipped';
