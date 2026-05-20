import { describe, test, expect } from "@jest/globals";
import { buildHlsManifestKey } from "../../services/transcode/hlsTranscode.js";

describe("hlsTranscode", () => {
  test("buildHlsManifestKey places manifest under hls/{fileId}", () => {
    const key = buildHlsManifestKey("companies/acme/media/video.mp4", 42);
    expect(key).toBe("companies/acme/media/hls/42/master.m3u8");
  });

  test("buildHlsManifestKey handles root-level paths", () => {
    const key = buildHlsManifestKey("video.mp4", 7);
    expect(key).toBe("hls/7/master.m3u8");
  });
});
