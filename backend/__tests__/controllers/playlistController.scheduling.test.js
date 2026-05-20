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
jest.unstable_mockModule("../../config/db.js", () => ({
  default: { query: jest.fn(), connect: jest.fn() },
}));
jest.unstable_mockModule("../../utils/firebaseAdmin.js", () => ({
  getFirebaseMessaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue("msg-id"),
  })),
}));
jest.unstable_mockModule("../../services/storage/index.js", () => ({
  putObject: jest.fn(),
}));
jest.unstable_mockModule("fs", () => ({
  default: { unlinkSync: jest.fn() },
  unlinkSync: jest.fn(),
}));

let controller;
let playlistModel;
let scheduleModel;
let deviceGroupModel;

beforeAll(async () => {
  controller = await import("../../controllers/playlistController.js");
  playlistModel = await import("../../models/playlistModel.js");
  scheduleModel = await import("../../models/playlistScheduleModel.js");
  deviceGroupModel = await import("../../models/deviceGroupModel.js");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("schedulePlaylistHandler", () => {
  test("returns 400 when device_group_id missing", async () => {
    const req = buildReq({ params: { id: "5" }, body: {} });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Device group is required",
    });
  });

  test("returns 404 when group not accessible", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(false);

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7, start_time: "2026-01-01T00:00:00Z" },
    });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Device group not found" });
  });

  test("defaults start_time to current ISO timestamp when omitted", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.schedulePlaylist.mockResolvedValue({ id: 5 });

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(playlistModel.schedulePlaylist).toHaveBeenCalledTimes(1);
    const callArgs = playlistModel.schedulePlaylist.mock.calls[0];
    expect(callArgs[0]).toBe(5);
    expect(callArgs[1]).toBe(10);
    expect(callArgs[2]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(callArgs[3]).toBe(null);
    expect(callArgs[4]).toBe(7);
    expect(res.json).toHaveBeenCalledWith({ success: true, playlist: { id: 5 } });
  });

  test("returns 404 when playlist not found", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.schedulePlaylist.mockResolvedValue(null);

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        start_time: "2026-01-01T00:00:00Z",
        end_time: "2026-01-02T00:00:00Z",
      },
    });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("schedules playlist on happy path", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.schedulePlaylist.mockResolvedValue({ id: 5 });

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        start_time: "2026-01-01T00:00:00Z",
        end_time: "2026-01-02T00:00:00Z",
      },
    });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(playlistModel.schedulePlaylist).toHaveBeenCalledWith(
      5,
      10,
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      7
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, playlist: { id: 5 } });
  });

  test("returns 500 on error", async () => {
    deviceGroupModel.canUserAccessGroup.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.schedulePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("clearPlaylistScheduleHandler", () => {
  test("returns 404 when playlist not found", async () => {
    playlistModel.clearPlaylistSchedule.mockResolvedValue(null);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.clearPlaylistScheduleHandler(req, res);

    expect(playlistModel.clearPlaylistSchedule).toHaveBeenCalledWith(5, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("clears schedule on success", async () => {
    const playlist = { id: 5, status: "inactive" };
    playlistModel.clearPlaylistSchedule.mockResolvedValue(playlist);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.clearPlaylistScheduleHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, playlist });
  });

  test("returns 500 on error", async () => {
    playlistModel.clearPlaylistSchedule.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.clearPlaylistScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("createDailyScheduleHandler", () => {
  test("returns 400 when device_group_id missing", async () => {
    const req = buildReq({
      params: { id: "5" },
      body: { daily_start_time: "08:00", daily_end_time: "18:00" },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Device group is required",
    });
  });

  test("returns 400 when start/end times missing", async () => {
    const req = buildReq({
      params: { id: "5" },
      body: { device_group_id: 7 },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Daily start and end time are required",
    });
  });

  test("returns 400 when start_time >= end_time", async () => {
    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "18:00",
        daily_end_time: "08:00",
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Daily start time must be before daily end time",
    });
  });

  test("returns 404 when group not accessible", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(false);

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "08:00",
        daily_end_time: "18:00",
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Device group not found" });
  });

  test("returns 404 when playlist not found", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.getPlaylistById.mockResolvedValue(null);

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "08:00",
        daily_end_time: "18:00",
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("creates schedule with enabled defaulting to true", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    scheduleModel.createDailySchedule.mockResolvedValue({ id: 99 });

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "08:00",
        daily_end_time: "18:00",
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(scheduleModel.createDailySchedule).toHaveBeenCalledWith({
      companyId: 10,
      deviceGroupId: 7,
      playlistId: 5,
      dailyStartTime: "08:00",
      dailyEndTime: "18:00",
      timezone: "Asia/Dubai",
      enabled: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, schedule: { id: 99 } });
  });

  test("respects explicit enabled=false", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    scheduleModel.createDailySchedule.mockResolvedValue({ id: 99 });

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "08:00",
        daily_end_time: "18:00",
        enabled: false,
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(scheduleModel.createDailySchedule).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  test("returns 500 on error", async () => {
    deviceGroupModel.canUserAccessGroup.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { id: "5" },
      body: {
        device_group_id: 7,
        daily_start_time: "08:00",
        daily_end_time: "18:00",
      },
    });
    const res = buildRes();

    await controller.createDailyScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("listSchedulesHandler", () => {
  test("lists schedules without filters", async () => {
    scheduleModel.listSchedules.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const req = buildReq();
    const res = buildRes();

    await controller.listSchedulesHandler(req, res);

    expect(deviceGroupModel.canUserAccessGroup).not.toHaveBeenCalled();
    expect(scheduleModel.listSchedules).toHaveBeenCalledWith({
      companyId: 10,
      deviceGroupId: null,
      playlistId: null,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      schedules: [{ id: 1 }, { id: 2 }],
    });
  });

  test("returns 404 when device_group_id provided but inaccessible", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(false);

    const req = buildReq({ query: { device_group_id: "7" } });
    const res = buildRes();

    await controller.listSchedulesHandler(req, res);

    expect(deviceGroupModel.canUserAccessGroup).toHaveBeenCalledWith(7, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Device group not found" });
  });

  test("passes through filters when group accessible", async () => {
    deviceGroupModel.canUserAccessGroup.mockResolvedValue(true);
    scheduleModel.listSchedules.mockResolvedValue([{ id: 3 }]);

    const req = buildReq({
      query: { device_group_id: "7", playlist_id: "5" },
    });
    const res = buildRes();

    await controller.listSchedulesHandler(req, res);

    expect(scheduleModel.listSchedules).toHaveBeenCalledWith({
      companyId: 10,
      deviceGroupId: 7,
      playlistId: 5,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      schedules: [{ id: 3 }],
    });
  });

  test("returns 500 on error", async () => {
    scheduleModel.listSchedules.mockRejectedValue(new Error("db"));

    const req = buildReq();
    const res = buildRes();

    await controller.listSchedulesHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("updateScheduleHandler", () => {
  test("returns 404 when schedule not found", async () => {
    scheduleModel.getScheduleById.mockResolvedValue(null);

    const req = buildReq({ params: { scheduleId: "9" }, body: {} });
    const res = buildRes();

    await controller.updateScheduleHandler(req, res);

    expect(scheduleModel.getScheduleById).toHaveBeenCalledWith({
      companyId: 10,
      scheduleId: 9,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Schedule not found" });
  });

  test("returns 400 when computed start >= end (using existing values)", async () => {
    scheduleModel.getScheduleById.mockResolvedValue({
      id: 9,
      daily_start_time: "08:00",
      daily_end_time: "18:00",
    });

    const req = buildReq({
      params: { scheduleId: "9" },
      body: { daily_start_time: "20:00" },
    });
    const res = buildRes();

    await controller.updateScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Daily start time must be before daily end time",
    });
    expect(scheduleModel.updateSchedule).not.toHaveBeenCalled();
  });

  test("updates schedule on success", async () => {
    scheduleModel.getScheduleById.mockResolvedValue({
      id: 9,
      daily_start_time: "08:00",
      daily_end_time: "18:00",
    });
    scheduleModel.updateSchedule.mockResolvedValue({
      id: 9,
      daily_start_time: "09:00",
      daily_end_time: "18:00",
      enabled: false,
    });

    const req = buildReq({
      params: { scheduleId: "9" },
      body: { daily_start_time: "09:00", enabled: false },
    });
    const res = buildRes();

    await controller.updateScheduleHandler(req, res);

    expect(scheduleModel.updateSchedule).toHaveBeenCalledWith({
      companyId: 10,
      scheduleId: 9,
      dailyStartTime: "09:00",
      dailyEndTime: undefined,
      enabled: false,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      schedule: {
        id: 9,
        daily_start_time: "09:00",
        daily_end_time: "18:00",
        enabled: false,
      },
    });
  });

  test("returns 500 on error", async () => {
    scheduleModel.getScheduleById.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { scheduleId: "9" }, body: {} });
    const res = buildRes();

    await controller.updateScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("deleteScheduleHandler", () => {
  test("returns 404 when schedule not found", async () => {
    scheduleModel.deleteSchedule.mockResolvedValue(null);

    const req = buildReq({ params: { scheduleId: "9" } });
    const res = buildRes();

    await controller.deleteScheduleHandler(req, res);

    expect(scheduleModel.deleteSchedule).toHaveBeenCalledWith({
      companyId: 10,
      scheduleId: 9,
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Schedule not found" });
  });

  test("deletes schedule on success", async () => {
    scheduleModel.deleteSchedule.mockResolvedValue({ id: 9 });

    const req = buildReq({ params: { scheduleId: "9" } });
    const res = buildRes();

    await controller.deleteScheduleHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test("returns 500 on error", async () => {
    scheduleModel.deleteSchedule.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { scheduleId: "9" } });
    const res = buildRes();

    await controller.deleteScheduleHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
