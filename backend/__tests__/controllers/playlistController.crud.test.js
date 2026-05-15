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
  putObject: jest.fn().mockResolvedValue({ key: "k" }),
}));
jest.unstable_mockModule("fs", () => ({
  default: { unlinkSync: jest.fn() },
  unlinkSync: jest.fn(),
}));

let controller;
let playlistModel;

beforeAll(async () => {
  controller = await import("../../controllers/playlistController.js");
  playlistModel = await import("../../models/playlistModel.js");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createPlaylistHandler", () => {
  test("returns 400 when name is missing", async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();

    await controller.createPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Playlist name is required",
    });
    expect(playlistModel.createPlaylist).not.toHaveBeenCalled();
  });

  test("returns 400 when name is whitespace", async () => {
    const req = buildReq({ body: { name: "   " } });
    const res = buildRes();

    await controller.createPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Playlist name is required",
    });
  });

  test("creates playlist on happy path with trimmed name", async () => {
    const fakePlaylist = { id: 99, name: "My Playlist" };
    playlistModel.createPlaylist.mockResolvedValue(fakePlaylist);

    const req = buildReq({
      body: { name: "  My Playlist  ", description: "Desc" },
    });
    const res = buildRes();

    await controller.createPlaylistHandler(req, res);

    expect(playlistModel.createPlaylist).toHaveBeenCalledWith(
      10,
      "My Playlist",
      "Desc",
      1
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      playlist: fakePlaylist,
    });
  });

  test("returns 500 when model throws", async () => {
    playlistModel.createPlaylist.mockRejectedValue(new Error("boom"));

    const req = buildReq({ body: { name: "Name" } });
    const res = buildRes();

    await controller.createPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("getPlaylistsHandler", () => {
  test("returns playlists for the user's company", async () => {
    const playlists = [{ id: 1 }, { id: 2 }];
    playlistModel.getPlaylistsByCompanyId.mockResolvedValue(playlists);

    const req = buildReq();
    const res = buildRes();

    await controller.getPlaylistsHandler(req, res);

    expect(playlistModel.getPlaylistsByCompanyId).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ success: true, playlists });
  });

  test("returns 500 when model throws", async () => {
    playlistModel.getPlaylistsByCompanyId.mockRejectedValue(new Error("nope"));

    const req = buildReq();
    const res = buildRes();

    await controller.getPlaylistsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("getPlaylistHandler", () => {
  let playlistItemModel;
  beforeAll(async () => {
    playlistItemModel = await import("../../models/playlistItemModel.js");
  });

  test("returns 404 when playlist is not found", async () => {
    playlistItemModel.getPlaylistWithItems.mockResolvedValue(null);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.getPlaylistHandler(req, res);

    expect(playlistItemModel.getPlaylistWithItems).toHaveBeenCalledWith(5, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("returns playlist on success", async () => {
    const playlist = { id: 5, name: "Foo", items: [] };
    playlistItemModel.getPlaylistWithItems.mockResolvedValue(playlist);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.getPlaylistHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, playlist });
  });

  test("returns 500 on error", async () => {
    playlistItemModel.getPlaylistWithItems.mockRejectedValue(
      new Error("DB error")
    );

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.getPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("updatePlaylistHandler", () => {
  test("returns 400 when name is missing", async () => {
    const req = buildReq({ params: { id: "1" }, body: {} });
    const res = buildRes();

    await controller.updatePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Playlist name is required",
    });
    expect(playlistModel.updatePlaylist).not.toHaveBeenCalled();
  });

  test("returns 404 when playlist not found", async () => {
    playlistModel.updatePlaylist.mockResolvedValue(null);

    const req = buildReq({
      params: { id: "1" },
      body: { name: "New", description: "D" },
    });
    const res = buildRes();

    await controller.updatePlaylistHandler(req, res);

    expect(playlistModel.updatePlaylist).toHaveBeenCalledWith(1, 10, "New", "D");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("updates playlist on success", async () => {
    const playlist = { id: 1, name: "New" };
    playlistModel.updatePlaylist.mockResolvedValue(playlist);

    const req = buildReq({
      params: { id: "1" },
      body: { name: "  New  " },
    });
    const res = buildRes();

    await controller.updatePlaylistHandler(req, res);

    expect(playlistModel.updatePlaylist).toHaveBeenCalledWith(
      1,
      10,
      "New",
      undefined
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, playlist });
  });

  test("returns 500 on error", async () => {
    playlistModel.updatePlaylist.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { id: "1" },
      body: { name: "New" },
    });
    const res = buildRes();

    await controller.updatePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("deletePlaylistHandler", () => {
  test("returns 404 when playlist does not exist", async () => {
    playlistModel.getPlaylistById.mockResolvedValue(null);

    const req = buildReq({ params: { id: "7" } });
    const res = buildRes();

    await controller.deletePlaylistHandler(req, res);

    expect(playlistModel.getPlaylistById).toHaveBeenCalledWith(7, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
    expect(playlistModel.deletePlaylist).not.toHaveBeenCalled();
  });

  test("returns 400 when playlist is active", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({
      id: 7,
      status: "active",
    });

    const req = buildReq({ params: { id: "7" } });
    const res = buildRes();

    await controller.deletePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Cannot delete an active playlist. Deactivate it first.",
    });
    expect(playlistModel.deletePlaylist).not.toHaveBeenCalled();
  });

  test("returns 400 when delete returns null (status changed mid-flight)", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({
      id: 7,
      status: "inactive",
    });
    playlistModel.deletePlaylist.mockResolvedValue(null);

    const req = buildReq({ params: { id: "7" } });
    const res = buildRes();

    await controller.deletePlaylistHandler(req, res);

    expect(playlistModel.deletePlaylist).toHaveBeenCalledWith(7, 10);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Cannot delete an active playlist. Deactivate it first.",
    });
  });

  test("deletes playlist on success", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({
      id: 7,
      status: "inactive",
    });
    playlistModel.deletePlaylist.mockResolvedValue({ id: 7 });

    const req = buildReq({ params: { id: "7" } });
    const res = buildRes();

    await controller.deletePlaylistHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Playlist deleted successfully",
    });
  });

  test("returns 500 on error", async () => {
    playlistModel.getPlaylistById.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { id: "7" } });
    const res = buildRes();

    await controller.deletePlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
