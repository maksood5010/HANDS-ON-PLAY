import { describe, test, expect } from "@jest/globals";
import { TRANSCODE_STATUS } from "../../models/fileModel.js";
import { getPlaybackUrl } from "../../utils/playbackUrl.js";
import { buildHlsManifestKey } from "../../services/transcode/hlsTranscode.js";

/**
 * End-to-end logic chain (no FFmpeg/DB): upload metadata → manifest key → device URL.
 */
describe("HLS pipeline (unit chain)", () => {
  const req = {
    protocol: "https",
    get: (h) => (h === "host" ? "api.example.com" : ""),
  };

  beforeAll(() => {
    process.env.UPLOAD_DRIVER = "local";
  });

  test("video file gets pending status constant and manifest key layout", () => {
    const fileId = 55;
    const filePath = "companies/acme/media/intro.mp4";
    const hlsPath = buildHlsManifestKey(filePath, fileId);

    expect(hlsPath).toBe("companies/acme/media/hls/55/master.m3u8");
    expect(TRANSCODE_STATUS.PENDING).toBe("pending");
    expect(TRANSCODE_STATUS.READY).toBe("ready");
  });

  test("after transcode ready, playback_url points at m3u8 not mp4", () => {
    const item = {
      file_type: "video",
      file_path: "companies/acme/media/intro.mp4",
      hls_path: "companies/acme/media/hls/55/master.m3u8",
      transcode_status: TRANSCODE_STATUS.READY,
    };

    const playback = getPlaybackUrl({ req, item });
    expect(playback).toContain(".m3u8");
    expect(playback).not.toMatch(/intro\.mp4$/);
  });

  test("while pending, playback_url stays on original mp4", () => {
    const item = {
      file_type: "video",
      file_path: "companies/acme/media/intro.mp4",
      hls_path: null,
      transcode_status: TRANSCODE_STATUS.PENDING,
    };

    const playback = getPlaybackUrl({ req, item });
    expect(playback).toContain("intro.mp4");
  });
});
