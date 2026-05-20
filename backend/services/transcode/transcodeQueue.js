import { transcodeFileById } from "./hlsTranscode.js";

const queue = [];
let activeCount = 0;

const maxConcurrent = Math.max(
  1,
  Math.min(4, parseInt(process.env.HLS_TRANSCODE_CONCURRENCY || "1", 10) || 1)
);

function drain() {
  while (activeCount < maxConcurrent && queue.length > 0) {
    const job = queue.shift();
    activeCount += 1;

    transcodeFileById(job.fileId, job.companyId, {
      localSourcePath: job.localSourcePath,
      sourceBuffer: job.sourceBuffer,
    })
      .catch((err) => {
        console.error(
          `[hls-queue] job failed file=${job.fileId}:`,
          err?.message || err
        );
      })
      .finally(() => {
        activeCount -= 1;
        drain();
      });
  }
}

/**
 * Enqueue async HLS transcode after upload. Does not block the HTTP response.
 * @param {{ fileId: number, companyId: number, localSourcePath?: string, sourceBuffer?: Buffer }} job
 */
export function enqueueVideoTranscode(job) {
  if (!job?.fileId || !job?.companyId) {
    console.warn("[hls-queue] skipped invalid job", job);
    return;
  }

  const payload = {
    fileId: job.fileId,
    companyId: job.companyId,
    localSourcePath: job.localSourcePath,
    sourceBuffer: job.sourceBuffer
      ? Buffer.isBuffer(job.sourceBuffer)
        ? Buffer.from(job.sourceBuffer)
        : Buffer.from(job.sourceBuffer)
      : undefined,
  };

  queue.push(payload);

  if (process.env.HLS_TRANSCODE_SYNC === "true") {
    // For tests: process immediately in-band
    drain();
    return;
  }

  setImmediate(drain);
}

export function getTranscodeQueueStats() {
  return { queued: queue.length, active: activeCount, maxConcurrent };
}
