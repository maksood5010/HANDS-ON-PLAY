import { jest, describe, beforeEach, beforeAll, test, expect } from "@jest/globals";
import { buildReq, buildRes } from "../helpers/mockReqRes.js";

jest.unstable_mockModule("../../models/playlistModel.js", () => ({
  createPlaylist: jest.fn(),
  getPlaylistsByCompanyId: jest.fn(),
  getPlaylistById: jest.fn(),
  updatePlaylist: jest.fn(),
  deletePlaylist: jest.fn(),
  updatePlaylistStatus: jest.fn(),
  schedulePlaylist: jest.fn(),
  clearPlaylistSchedule: jest.fn(),
}));
jest.unstable_mockModule("../../models/playlistItemModel.js", () => ({
  getPlaylistWithItems: jest.fn(),
  addItemToPlaylist: jest.fn(),
  getPlaylistItems: jest.fn(),
  updateItemDuration: jest.fn(),
  deleteItem: jest.fn(),
  getNextDisplayOrder: jest.fn(),
  swapItemOrder: jest.fn(),
}));
jest.unstable_mockModule("../../models/playlistScheduleModel.js", () => ({
  createDailySchedule: jest.fn(),
  listSchedules: jest.fn(),
  updateSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  getScheduleById: jest.fn(),
}));
jest.unstable_mockModule("../../models/deviceGroupModel.js", () => ({
  canUserAccessGroup: jest.fn(),
}));
jest.unstable_mockModule("../../models/fileModel.js", () => ({
  saveFile: jest.fn(),
  getFileById: jest.fn(),
  deleteFile: jest.fn(),
}));

const poolQuery = jest.fn();
jest.unstable_mockModule("../../config/db.js", () => ({
  default: { query: poolQuery, connect: jest.fn() },
}));

const fcmSend = jest.fn();
jest.unstable_mockModule("../../utils/firebaseAdmin.js", () => ({
  getFirebaseMessaging: jest.fn(() => ({ send: fcmSend })),
}));

jest.unstable_mockModule("../../services/storage/index.js", () => ({
  putObject: jest.fn(),
}));
jest.unstable_mockModule("../../services/transcode/transcodeQueue.js", () => ({
  enqueueVideoTranscode: jest.fn(),
}));
jest.unstable_mockModule("fs", () => ({
  default: { unlinkSync: jest.fn() },
  unlinkSync: jest.fn(),
}));

let controller;
let playlistModel;
let deviceGroupModel;

beforeAll(async () => {
  controller = await import("../../controllers/playlistController.js");
  playlistModel = await import("../../models/playlistModel.js");
  deviceGroupModel = await import("../../models/deviceGroupModel.js");
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  fcmSend.mockResolvedValue("msg-id");
});

describe("setPlaylistActiveHandler", () => {
  test("returns 400 when device_group_id missing", async () => {
    const req = buildReq({ params: { id: "5" }, body: {} });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Device group is required",
    });
    expect(deviceGroupModel.canUserAccessGroup).not.toHaveBeenCalled();
  });

  test("returns 404 when user cannot access device group", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(false);

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(deviceGroupModel.canUserAccessGroup).toHaveBeenCalledWith(7, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Device group not found" });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test("returns 404 when updatePlaylistStatus returns null", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    poolQuery.mockResolvedValueOnce({ rows: [] });
    playlistModel.updatePlaylistStatus.mockResolvedValue(null);

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
    expect(fcmSend).not.toHaveBeenCalled();
  });

  test("activates playlist and sends FCM with group topic on happy path", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [] }) // deactivation UPDATE
      .mockResolvedValueOnce({
        rows: [{ name: "Lobby", user_id: 1 }], // group lookup (regular group)
      });
    playlistModel.updatePlaylistStatus.mockResolvedValue({ id: 5 });

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(poolQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/UPDATE playlists/),
      [10, 7, 5]
    );
    expect(playlistModel.updatePlaylistStatus).toHaveBeenCalledWith(
      5,
      10,
      "active",
      7
    );
    expect(poolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/FROM device_groups/),
      [7, 10]
    );

    expect(fcmSend).toHaveBeenCalledTimes(1);
    const sendArg = fcmSend.mock.calls[0][0];
    expect(sendArg.topic).toBe("c_10_g_7");
    expect(sendArg.data).toEqual({
      type: "playlist_refresh",
      company_id: "10",
      group_id: "7",
      playlist_id: "5",
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      playlist: { id: 5 },
    });
  });

  test("uses company-wide topic when group is the 'All devices' group", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ name: "All devices", user_id: null }],
      });
    playlistModel.updatePlaylistStatus.mockResolvedValue({ id: 5 });

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(fcmSend).toHaveBeenCalledTimes(1);
    expect(fcmSend.mock.calls[0][0].topic).toBe("c_10_all");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      playlist: { id: 5 },
    });
  });

  test("falls back to group topic when group lookup query throws", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("group lookup failed"));
    playlistModel.updatePlaylistStatus.mockResolvedValue({ id: 5 });

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(fcmSend.mock.calls[0][0].topic).toBe("c_10_g_7");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      playlist: { id: 5 },
    });
  });

  test("does not fail the request when FCM send rejects", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: "Lobby", user_id: 1 }] });
    playlistModel.updatePlaylistStatus.mockResolvedValue({ id: 5 });
    fcmSend.mockRejectedValueOnce(new Error("FCM down"));

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      playlist: { id: 5 },
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  test("returns 500 when access check throws", async () => {
    deviceGroupModel.canUserAccessGroup.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.setPlaylistActiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("setPlaylistInactiveHandler", () => {
  test("returns 404 when playlist not found", async () => {
    playlistModel.updatePlaylistStatus.mockResolvedValue(null);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.setPlaylistInactiveHandler(req, res);

    expect(playlistModel.updatePlaylistStatus).toHaveBeenCalledWith(
      5,
      10,
      "inactive"
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("deactivates playlist on success", async () => {
    const playlist = { id: 5, status: "inactive" };
    playlistModel.updatePlaylistStatus.mockResolvedValue(playlist);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.setPlaylistInactiveHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, playlist });
  });

  test("returns 500 on error", async () => {
    playlistModel.updatePlaylistStatus.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.setPlaylistInactiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
