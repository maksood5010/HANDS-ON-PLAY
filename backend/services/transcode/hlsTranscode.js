import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  getFileById,
  getFileByIdAnyCompany,
  TRANSCODE_STATUS,
  updateFileTranscode,
} from "../../models/fileModel.js";
import { getObject, putObject } from "../storage/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, "../../uploads");

const isSpacesDriver = () =>
  String(process.env.UPLOAD_DRIVER || "spaces").trim().toLowerCase() === "spaces";

function contentTypeForHlsFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".m3u8") return "application/vnd.apple.mpegurl";
  if (ext === ".ts") return "video/mp2t";
  return "application/octet-stream";
}

export function buildHlsManifestKey(filePath, fileId) {
  const normalized = String(filePath || "").replace(/^\/+/, "");
  const dir = path.posix.dirname(normalized);
  const prefix = dir && dir !== "." ? `${dir}/hls/${fileId}` : `hls/${fileId}`;
  return `${prefix}/master.m3u8`;
}

function runFfmpeg(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      process.env.HLS_FFMPEG_PRESET || "veryfast",
      "-crf",
      String(process.env.HLS_FFMPEG_CRF || "23"),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-hls_time",
      String(process.env.HLS_SEGMENT_SECONDS || "6"),
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(outputDir, "seg%03d.ts"),
      path.join(outputDir, "master.m3u8"),
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("ffmpeg not found on PATH; install ffmpeg on the server"));
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

async function uploadHlsOutputDir(outputDir, keyPrefix) {
  const entries = await fsp.readdir(outputDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);

  for (const name of files) {
    const body = await fsp.readFile(path.join(outputDir, name));
    const key = `${keyPrefix}/${name}`;
    await putObject({
      key,
      body,
      contentType: contentTypeForHlsFile(name),
      cacheControl: "public, max-age=31536000, immutable",
    });
  }
}

async function resolveSourceToPath(fileRecord, { localSourcePath, sourceBuffer }) {
  if (localSourcePath && fs.existsSync(localSourcePath)) {
    return localSourcePath;
  }

  if (sourceBuffer && sourceBuffer.length > 0) {
    const tmpInput = path.join(
      await fsp.mkdtemp(path.join(os.tmpdir(), "hls-in-")),
      path.basename(fileRecord.file_path || "source.mp4")
    );
    await fsp.writeFile(tmpInput, sourceBuffer);
    return tmpInput;
  }

  if (!isSpacesDriver()) {
    const localPath = path.join(UPLOADS_ROOT, fileRecord.file_path);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
    throw new Error(`Local source not found: ${localPath}`);
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "hls-dl-"));
  const tmpInput = path.join(
    tmpDir,
    path.basename(fileRecord.file_path || "source.mp4")
  );
  const body = await getObject({ key: fileRecord.file_path });
  await fsp.writeFile(tmpInput, body);
  return tmpInput;
}

async function rmSafe(target) {
  try {
    await fsp.rm(target, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Transcode a video file to HLS and upload segments + manifest to storage.
 */
export async function transcodeVideoFile(fileRecord, sourceOptions = {}) {
  if (!fileRecord || fileRecord.file_type !== "video") {
    return null;
  }

  if (fileRecord.transcode_status === TRANSCODE_STATUS.READY && fileRecord.hls_path) {
    return fileRecord;
  }

  const fileId = fileRecord.id;
  const companyId = fileRecord.company_id;
  const manifestKey = buildHlsManifestKey(fileRecord.file_path, fileId);
  const keyPrefix = path.posix.dirname(manifestKey);

  await updateFileTranscode(fileId, companyId, {
    status: TRANSCODE_STATUS.PENDING,
    error: null,
  });

  let inputPath = null;
  let inputIsTemp = false;
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "hls-work-"));
  const outputDir = path.join(workDir, "out");
  await fsp.mkdir(outputDir, { recursive: true });

  try {
    inputPath = await resolveSourceToPath(fileRecord, sourceOptions);
    inputIsTemp =
      inputPath.includes(os.tmpdir()) &&
      !inputPath.startsWith(UPLOADS_ROOT);

    await runFfmpeg(inputPath, outputDir);

    const manifestPath = path.join(outputDir, "master.m3u8");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("ffmpeg did not produce master.m3u8");
    }

    await uploadHlsOutputDir(outputDir, keyPrefix);

    const updated = await updateFileTranscode(fileId, companyId, {
      hlsPath: manifestKey,
      status: TRANSCODE_STATUS.READY,
      error: null,
    });

    console.log(`[hls] ready file=${fileId} manifest=${manifestKey}`);
    return updated;
  } catch (err) {
    const message = err?.message || String(err);
    console.error(`[hls] failed file=${fileId}:`, message);
    await updateFileTranscode(fileId, companyId, {
      status: TRANSCODE_STATUS.FAILED,
      error: message.slice(0, 2000),
    });
    throw err;
  } finally {
    await rmSafe(workDir);
    if (inputIsTemp && inputPath) {
      await rmSafe(path.dirname(inputPath));
    }
  }
}

/**
 * Load file by id and transcode (used by queue and backfill).
 */
export async function transcodeFileById(fileId, companyId, sourceOptions = {}) {
  const fileRecord = companyId
    ? await getFileById(fileId, companyId)
    : await getFileByIdAnyCompany(fileId);

  if (!fileRecord) {
    throw new Error(`File not found: ${fileId}`);
  }

  return transcodeVideoFile(fileRecord, sourceOptions);
}
