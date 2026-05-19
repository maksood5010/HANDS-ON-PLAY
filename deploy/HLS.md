# HLS transcoding (Phase 1)

Video uploads are transcoded to HLS (`.m3u8` + `.ts` segments) asynchronously. Devices use `playback_url` from the display API when transcode status is `ready`.

## Server requirements

- **ffmpeg** with `libx264` and `aac` (Ubuntu/Debian: `apt-get install -y ffmpeg`)
- PostgreSQL migration applied

## First-time setup on droplet

```bash
cd /var/www/backend
apt-get update && apt-get install -y ffmpeg
npm run db:migrate
pm2 restart hands-on-play-api
```

## Backfill existing videos

Processes a small batch per run (default 3). Re-run until no videos remain:

```bash
cd /var/www/backend
node scripts/backfill-hls.js
# or: npm run backfill:hls
```

Optional env:

| Variable | Default | Description |
|----------|---------|-------------|
| `HLS_BACKFILL_BATCH` | `3` | Videos per script run |
| `HLS_TRANSCODE_CONCURRENCY` | `1` | Parallel jobs in API process |
| `HLS_SEGMENT_SECONDS` | `6` | Segment length |
| `HLS_FFMPEG_PRESET` | `veryfast` | x264 preset |
| `HLS_FFMPEG_CRF` | `23` | Quality |

## Upload feels stuck at 100%?

Browser progress hits **100% when the file finishes uploading to your API**. The modal stays open until the server finishes **uploading to Spaces** and saving DB rows. HLS transcoding runs **after** the HTTP response (async) and does not block the upload UI.

Check API logs for timings (`UPLOAD_TIMING_LOGS` is on by default in development):

```text
[upload] ← incoming POST /api/playlists/5/upload content-length=...
[upload] multer finished (body parsed into memory) 3200ms
[upload:handler-playlist-5] handler_start +5ms (total 3205ms)
[upload:file-video.mp4] spaces_putObject_start +2ms (total 10ms)
[upload:spaces] PutObject ok 85.20MB in 38000ms key=companies/...
[upload:file-video.mp4] spaces_putObject_done +38005ms (total 38015ms)
[upload:file-video.mp4] db_saveFile +12ms ...
[upload] → response 201 ... total=41200ms
```

- Large **multer finished** → slow network receiving the file into RAM.
- Large **PutObject** → slow upload from your Mac to Spaces (common on local dev).
- Set `UPLOAD_TIMING_LOGS=false` to disable.

If `putObject` is slow, use smaller files, faster droplet↔Spaces network, or future work: stream uploads / return 202 immediately.

Ensure `HLS_TRANSCODE_SYNC` is **not** set to `true` in production `.env` (that would block the response on FFmpeg).

## Display API

Each playlist item includes:

- `file_url` — original asset (MP4/image)
- `playback_url` — HLS manifest when ready, else same as `file_url`
- `transcode_status` — `pending`, `ready`, `failed`, or `skipped`
