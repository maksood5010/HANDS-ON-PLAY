import { describe, test, expect } from "@jest/globals";
import { getPlaybackUrl } from "../../utils/playbackUrl.js";

describe("getPlaybackUrl", () => {
  const req = {
    protocol: "https",
    get: (header) => (header === "host" ? "api.example.com" : ""),
  };

  beforeAll(() => {
    process.env.UPLOAD_DRIVER = "local";
  });

  test("returns file_url for images", () => {
    const url = getPlaybackUrl({
      req,
      item: {
        file_type: "image",
        file_path: "companies/a/photo.png",
        transcode_status: "skipped",
      },
    });
    expect(url).toContain("companies/a/photo.png");
  });

  test("returns HLS manifest when video transcode is ready", () => {
    const url = getPlaybackUrl({
      req,
      item: {
        file_type: "video",
        file_path: "companies/a/video.mp4",
        hls_path: "companies/a/hls/1/master.m3u8",
        transcode_status: "ready",
      },
    });

    expect(url).toBe("https://api.example.com/uploads/companies/a/hls/1/master.m3u8");
  });

  test("falls back to MP4 while transcode is pending", () => {
    const url = getPlaybackUrl({
      req,
      item: {
        file_type: "video",
        file_path: "companies/a/video.mp4",
        hls_path: null,
        transcode_status: "pending",
      },
    });

    expect(url).toBe("https://api.example.com/uploads/companies/a/video.mp4");
  });
});
