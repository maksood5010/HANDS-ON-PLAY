import { TRANSCODE_STATUS } from "../models/fileModel.js";
import { getPublicFileUrl } from "./publicFileUrl.js";

/**
 * Preferred URL for device playback: HLS manifest when ready, else original file.
 */
export function getPlaybackUrl({ req, item }) {
  const fallback = getPublicFileUrl({ req, key: item.file_path });
  if (!fallback) return null;

  if (item.file_type !== "video") {
    return fallback;
  }

  if (
    item.transcode_status === TRANSCODE_STATUS.READY &&
    item.hls_path
  ) {
    return getPublicFileUrl({ req, key: item.hls_path }) || fallback;
  }

  return fallback;
}
