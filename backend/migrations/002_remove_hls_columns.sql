ALTER TABLE files
  DROP COLUMN IF EXISTS hls_path,
  DROP COLUMN IF EXISTS transcode_status,
  DROP COLUMN IF EXISTS transcode_error;
