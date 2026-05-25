const PLAYBACK_STATES = new Set([
  "playing",
  "idle",
  "not_playing",
  "error",
  "setup",
  "app_closed",
]);

const HEALTH_STATUSES = new Set(["ok", "warning", "error"]);

const NOT_PLAYING = "not_playing";

const PRESENCE_VALUES = new Set(["open", "closed"]);

/**
 * Periodic heartbeat: plain text open | closed.
 * @param {Buffer|string} raw
 * @returns {"open"|"closed"|null}
 */
export function parsePresencePayload(raw) {
  const text = (Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw ?? ""))
    .trim()
    .toLowerCase();
  return PRESENCE_VALUES.has(text) ? text : null;
}

function trimStr(v, maxLen) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/** On-demand status/response topic: full JSON payload. */
export function parseStatusResponsePayload(raw) {
  return parseHeartbeatPayload(raw);
}

/**
 * @param {Buffer|string} raw
 * @returns {object|null}
 */
export function parseHeartbeatPayload(raw) {
  let text;
  try {
    text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw ?? "");
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;

    const device_key = trimStr(data.device_key, 100);
    if (!device_key) return null;

    let currently_playing = trimStr(data.currently_playing, 2048);
    if (!currently_playing) {
      currently_playing = NOT_PLAYING;
    }

    const app_version = trimStr(data.app_version, 32);
    const playback_state = trimStr(data.playback_state, 32);
    const health_status = trimStr(data.health_status, 32);

    if (!playback_state || !PLAYBACK_STATES.has(playback_state)) {
      return null;
    }
    if (!health_status || !HEALTH_STATUSES.has(health_status)) {
      return null;
    }

    return {
      device_key,
      currently_playing,
      app_version,
      playback_state,
      health_status,
    };
  } catch {
    return null;
  }
}

export const HEARTBEAT_DEFAULTS = {
  currently_playing: NOT_PLAYING,
  app_version: null,
  playback_state: "not_playing",
  health_status: "ok",
};
