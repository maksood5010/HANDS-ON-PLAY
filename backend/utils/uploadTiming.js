/**
 * Structured timing logs for playlist uploads.
 * Enable with UPLOAD_TIMING_LOGS=true (default: on in non-production).
 */
function timingEnabled() {
  const env = process.env.UPLOAD_TIMING_LOGS;
  if (env === "false" || env === "0") return false;
  if (env === "true" || env === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * @param {string} label
 * @returns {{ step: (name: string, extra?: Record<string, unknown>) => void, done: (name?: string) => number }}
 */
export function createUploadTimer(label) {
  const start = Date.now();
  let last = start;

  const step = (name, extra = {}) => {
    if (!timingEnabled()) return;
    const now = Date.now();
    const sinceLast = now - last;
    const sinceStart = now - start;
    const extraStr =
      Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
    console.log(
      `[upload:${label}] ${name} +${sinceLast}ms (total ${sinceStart}ms)${extraStr}`
    );
    last = now;
  };

  const done = (name = "done") => {
    step(name);
    return Date.now() - start;
  };

  return { step, done };
}

/** Log when the HTTP request hits the server (before multer finishes parsing the body). */
export function logUploadRequestStart(req, res, next) {
  if (!timingEnabled()) return next();

  req._uploadReqStart = Date.now();
  const contentLength = req.headers["content-length"] || "?";
  console.log(
    `[upload] ← incoming ${req.method} ${req.originalUrl} content-length=${contentLength}`
  );

  res.on("finish", () => {
    const total = Date.now() - req._uploadReqStart;
    console.log(
      `[upload] → response ${res.statusCode} ${req.method} ${req.originalUrl} total=${total}ms`
    );
  });

  next();
}

/** Call at the start of the upload handler (after multer). */
export function logAfterMulter(req, extra = {}) {
  if (!timingEnabled() || !req._uploadReqStart) return;
  const multerMs = Date.now() - req._uploadReqStart;
  console.log(
    `[upload] multer finished (body parsed into memory) ${multerMs}ms`,
    JSON.stringify(extra)
  );
}
