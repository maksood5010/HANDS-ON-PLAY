import { jest, describe, beforeEach, beforeAll, test, expect } from "@jest/globals";
import { buildReq, buildRes } from "../helpers/mockReqRes.js";

jest.unstable_mockModule("../../models/deviceModel.js", () => ({
  getDeviceByKey: jest.fn(),
  updateDeviceLastSeen: jest.fn(),
}));
jest.unstable_mockModule("../../models/playlistModel.js", () => ({
  getActivePlaylistWithMeta: jest.fn(),
}));
jest.unstable_mockModule("../../models/playlistItemModel.js", () => ({
  getPlaylistWithItems: jest.fn(),
}));
jest.unstable_mockModule("../../config/db.js", () => ({
  default: { query: jest.fn() },
}));

let displayController;
let deviceModel;
let playlistModel;
let playlistItemModel;
let pool;

beforeAll(async () => {
  displayController = await import("../../controllers/displayController.js");
  deviceModel = await import("../../models/deviceModel.js");
  playlistModel = await import("../../models/playlistModel.js");
  playlistItemModel = await import("../../models/playlistItemModel.js");
  pool = (await import("../../config/db.js")).default;
  process.env.UPLOAD_DRIVER = "local";
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe("getActivePlaylistForDisplay HLS fields", () => {
  test("includes playback_url as HLS manifest when transcode is ready", async () => {
    deviceModel.getDeviceByKey.mockResolvedValue({
      id: 1,
      company_id: 10,
      group_id: 5,
    });
    deviceModel.updateDeviceLastSeen.mockResolvedValue(true);
    playlistModel.getActivePlaylistWithMeta.mockResolvedValue({
      playlist: { id: 99, updated_at: "2026-01-01", created_at: "2026-01-01" },
      class: "active",
    });
    playlistItemModel.getPlaylistWithItems.mockResolvedValue({
      id: 99,
      name: "Test",
      description: null,
      status: "active",
      items: [
        {
          id: 1,
          file_id: 10,
          duration: null,
          display_order: 1,
          file_type: "video",
          file_path: "companies/acme/media/clip.mp4",
          hls_path: "companies/acme/media/hls/10/master.m3u8",
          transcode_status: "ready",
          original_name: "clip.mp4",
          mime_type: "video/mp4",
        },
      ],
    });

    const req = buildReq({
      query: { device_key: "dev-key" },
      protocol: "https",
      get: (h) => (h === "host" ? "api.example.com" : ""),
    });
    const res = buildRes();

    await displayController.getActivePlaylistForDisplay(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        playlist: expect.objectContaining({
          items: [
            expect.objectContaining({
              file_url: "https://api.example.com/uploads/companies/acme/media/clip.mp4",
              playback_url:
                "https://api.example.com/uploads/companies/acme/media/hls/10/master.m3u8",
              transcode_status: "ready",
            }),
          ],
        }),
      })
    );
  });

  test("playback_url falls back to MP4 while transcode is pending", async () => {
    deviceModel.getDeviceByKey.mockResolvedValue({
      id: 1,
      company_id: 10,
      group_id: 5,
    });
    deviceModel.updateDeviceLastSeen.mockResolvedValue(true);
    playlistModel.getActivePlaylistWithMeta.mockResolvedValue({
      playlist: { id: 99, updated_at: "2026-01-01", created_at: "2026-01-01" },
      class: "active",
    });
    playlistItemModel.getPlaylistWithItems.mockResolvedValue({
      id: 99,
      name: "Test",
      description: null,
      status: "active",
      items: [
        {
          id: 2,
          file_id: 11,
          duration: null,
          display_order: 1,
          file_type: "video",
          file_path: "companies/acme/media/pending.mp4",
          hls_path: null,
          transcode_status: "pending",
          original_name: "pending.mp4",
          mime_type: "video/mp4",
        },
      ],
    });

    const req = buildReq({
      query: { device_key: "dev-key" },
      protocol: "https",
      get: (h) => (h === "host" ? "api.example.com" : ""),
    });
    const res = buildRes();

    await displayController.getActivePlaylistForDisplay(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.playlist.items[0].playback_url).toBe(
      "https://api.example.com/uploads/companies/acme/media/pending.mp4"
    );
    expect(payload.playlist.items[0].transcode_status).toBe("pending");
  });
});
