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

const fsUnlinkSync = jest.fn();
jest.unstable_mockModule("fs", () => ({
  default: { unlinkSync: fsUnlinkSync },
  unlinkSync: fsUnlinkSync,
}));

let controller;
let playlistModel;
let playlistItemModel;
let fileModel;
let storage;

beforeAll(async () => {
  controller = await import("../../controllers/playlistController.js");
  playlistModel = await import("../../models/playlistModel.js");
  playlistItemModel = await import("../../models/playlistItemModel.js");
  fileModel = await import("../../models/fileModel.js");
  storage = await import("../../services/storage/index.js");
  jest.spyOn(console, "error").mockImplementation(() => {});
  process.env.UPLOAD_DRIVER = "spaces";
});

beforeEach(() => {
  jest.clearAllMocks();
});

const makeImageFile = (overrides = {}) => ({
  originalname: "photo.png",
  filename: "photo.png",
  mimetype: "image/png",
  size: 1024,
  buffer: Buffer.from("fake-image"),
  path: "/tmp/upload/photo.png",
  ...overrides,
});

const makeVideoFile = (overrides = {}) => ({
  originalname: "movie.mp4",
  filename: "movie.mp4",
  mimetype: "video/mp4",
  size: 4096,
  buffer: Buffer.from("fake-video"),
  path: "/tmp/upload/movie.mp4",
  ...overrides,
});

describe("uploadFileToPlaylistHandler", () => {
  test("returns 400 when no file is uploaded", async () => {
    const req = buildReq({ params: { playlistId: "1" } });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "No file uploaded" });
    expect(playlistModel.getPlaylistById).not.toHaveBeenCalled();
  });

  test("returns 404 and cleans up file when playlist is missing", async () => {
    playlistModel.getPlaylistById.mockResolvedValue(null);

    const file = makeImageFile();
    const req = buildReq({ params: { playlistId: "5" }, file });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(playlistModel.getPlaylistById).toHaveBeenCalledWith(5, 10);
    expect(fsUnlinkSync).toHaveBeenCalledWith(file.path);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
  });

  test("uploads to spaces and creates a playlist item with default image duration", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    fileModel.saveFile.mockResolvedValue({ id: 100, original_name: "photo.png" });
    playlistItemModel.getNextDisplayOrder.mockResolvedValue(3);
    playlistItemModel.addItemToPlaylist.mockResolvedValue({
      id: 200,
      display_order: 3,
    });

    const file = makeImageFile();
    const req = buildReq({
      params: { playlistId: "5" },
      file,
      body: {},
    });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const putCall = storage.putObject.mock.calls[0][0];
    expect(putCall.key).toMatch(/^companies\/acme\/media\/\d+-\d+-photo\.png$/);
    expect(putCall.body).toBe(file.buffer);
    expect(putCall.contentType).toBe("image/png");

    expect(fileModel.saveFile).toHaveBeenCalledWith(
      10,
      "photo.png",
      expect.stringMatching(/^\d+-\d+-photo\.png$/),
      expect.stringMatching(/^companies\/acme\/media\/\d+-\d+-photo\.png$/),
      "image",
      1024,
      "image/png",
      1
    );

    expect(playlistItemModel.getNextDisplayOrder).toHaveBeenCalledWith(5, 10);
    expect(playlistItemModel.addItemToPlaylist).toHaveBeenCalledWith(
      10,
      5,
      100,
      5,
      3
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      file: { id: 100, original_name: "photo.png" },
      playlistItem: { id: 200, display_order: 3 },
    });
  });

  test("uses null duration for video files", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    fileModel.saveFile.mockResolvedValue({ id: 101 });
    playlistItemModel.getNextDisplayOrder.mockResolvedValue(1);
    playlistItemModel.addItemToPlaylist.mockResolvedValue({ id: 201 });

    const req = buildReq({
      params: { playlistId: "5" },
      file: makeVideoFile(),
      body: {},
    });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(playlistItemModel.addItemToPlaylist).toHaveBeenCalledWith(
      10,
      5,
      101,
      null,
      1
    );
  });

  test("uses provided duration override for image files", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    fileModel.saveFile.mockResolvedValue({ id: 102 });
    playlistItemModel.getNextDisplayOrder.mockResolvedValue(2);
    playlistItemModel.addItemToPlaylist.mockResolvedValue({ id: 202 });

    const req = buildReq({
      params: { playlistId: "5" },
      file: makeImageFile(),
      body: { duration: "12" },
    });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(playlistItemModel.addItemToPlaylist).toHaveBeenCalledWith(
      10,
      5,
      102,
      12,
      2
    );
  });

  test("returns 500 and cleans up file when storage throws", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    storage.putObject.mockRejectedValueOnce(new Error("s3 down"));

    const file = makeImageFile();
    const req = buildReq({
      params: { playlistId: "5" },
      file,
      body: {},
    });
    const res = buildRes();

    await controller.uploadFileToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(fsUnlinkSync).toHaveBeenCalledWith(file.path);
  });
});

describe("uploadFilesToPlaylistHandler", () => {
  test("returns 400 when no files are uploaded", async () => {
    const req = buildReq({ params: { playlistId: "5" }, files: [] });
    const res = buildRes();

    await controller.uploadFilesToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "No files uploaded" });
  });

  test("returns 401 when user/company missing", async () => {
    const req = buildReq({
      params: { playlistId: "5" },
      files: [makeImageFile()],
      user: { id: null, company_id: null },
    });
    const res = buildRes();

    await controller.uploadFilesToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
  });

  test("returns 404 and cleans up all files when playlist missing", async () => {
    playlistModel.getPlaylistById.mockResolvedValue(null);

    const files = [makeImageFile(), makeVideoFile()];
    const req = buildReq({ params: { playlistId: "5" }, files });
    const res = buildRes();

    await controller.uploadFilesToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Playlist not found" });
    expect(fsUnlinkSync).toHaveBeenCalledWith(files[0].path);
    expect(fsUnlinkSync).toHaveBeenCalledWith(files[1].path);
    expect(fsUnlinkSync).toHaveBeenCalledTimes(2);
  });

  test("uploads multiple files with durations[] array", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    fileModel.saveFile
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });
    playlistItemModel.getNextDisplayOrder
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    playlistItemModel.addItemToPlaylist
      .mockResolvedValueOnce({ id: 11 })
      .mockResolvedValueOnce({ id: 12 });

    const files = [makeImageFile(), makeImageFile()];
    const req = buildReq({
      params: { playlistId: "5" },
      files,
      body: { "durations[]": ["7", "9"] },
    });
    const res = buildRes();

    await controller.uploadFilesToPlaylistHandler(req, res);

    expect(playlistItemModel.addItemToPlaylist).toHaveBeenNthCalledWith(
      1,
      10,
      5,
      1,
      7,
      1
    );
    expect(playlistItemModel.addItemToPlaylist).toHaveBeenNthCalledWith(
      2,
      10,
      5,
      2,
      9,
      2
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      files: [{ id: 1 }, { id: 2 }],
      playlistItems: [{ id: 11 }, { id: 12 }],
    });
  });

  test("returns 500 and cleans up all files on error", async () => {
    playlistModel.getPlaylistById.mockResolvedValue({ id: 5 });
    storage.putObject.mockRejectedValueOnce(new Error("oops"));

    const files = [makeImageFile(), makeImageFile()];
    const req = buildReq({ params: { playlistId: "5" }, files });
    const res = buildRes();

    await controller.uploadFilesToPlaylistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(fsUnlinkSync).toHaveBeenCalledTimes(2);
  });
});

describe("getPlaylistItemsHandler", () => {
  test("returns items on success", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    playlistItemModel.getPlaylistItems.mockResolvedValue(items);

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.getPlaylistItemsHandler(req, res);

    expect(playlistItemModel.getPlaylistItems).toHaveBeenCalledWith(5, 10);
    expect(res.json).toHaveBeenCalledWith({ success: true, items });
  });

  test("returns 500 on error", async () => {
    playlistItemModel.getPlaylistItems.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { id: "5" } });
    const res = buildRes();

    await controller.getPlaylistItemsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("updateItemDurationHandler", () => {
  test("returns 400 when duration is missing", async () => {
    const req = buildReq({ params: { itemId: "1" }, body: {} });
    const res = buildRes();

    await controller.updateItemDurationHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Duration must be at least 1 second",
    });
  });

  test("returns 400 when duration < 1", async () => {
    const req = buildReq({ params: { itemId: "1" }, body: { duration: 0 } });
    const res = buildRes();

    await controller.updateItemDurationHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 404 when item not found", async () => {
    playlistItemModel.updateItemDuration.mockResolvedValue(null);

    const req = buildReq({
      params: { itemId: "1" },
      body: { duration: 10 },
    });
    const res = buildRes();

    await controller.updateItemDurationHandler(req, res);

    expect(playlistItemModel.updateItemDuration).toHaveBeenCalledWith(1, 10, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Item not found" });
  });

  test("updates duration on success", async () => {
    const item = { id: 1, duration: 10 };
    playlistItemModel.updateItemDuration.mockResolvedValue(item);

    const req = buildReq({
      params: { itemId: "1" },
      body: { duration: "10" },
    });
    const res = buildRes();

    await controller.updateItemDurationHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, item });
  });

  test("returns 500 on error", async () => {
    playlistItemModel.updateItemDuration.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { itemId: "1" },
      body: { duration: 10 },
    });
    const res = buildRes();

    await controller.updateItemDurationHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("updateItemOrderHandler", () => {
  test("returns 400 when direction is missing", async () => {
    const req = buildReq({ params: { itemId: "1" }, body: {} });
    const res = buildRes();

    await controller.updateItemOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Direction must be 'up' or 'down'",
    });
  });

  test("returns 400 when direction is invalid", async () => {
    const req = buildReq({
      params: { itemId: "1" },
      body: { direction: "left" },
    });
    const res = buildRes();

    await controller.updateItemOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 404 when swap returns null", async () => {
    playlistItemModel.swapItemOrder.mockResolvedValue(null);

    const req = buildReq({
      params: { itemId: "1" },
      body: { direction: "up" },
    });
    const res = buildRes();

    await controller.updateItemOrderHandler(req, res);

    expect(playlistItemModel.swapItemOrder).toHaveBeenCalledWith(1, 10, "up");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Item not found or cannot be moved",
    });
  });

  test("swaps items on success", async () => {
    const item = { id: 1, display_order: 2 };
    playlistItemModel.swapItemOrder.mockResolvedValue(item);

    const req = buildReq({
      params: { itemId: "1" },
      body: { direction: "down" },
    });
    const res = buildRes();

    await controller.updateItemOrderHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, item });
  });

  test("returns 500 on error", async () => {
    playlistItemModel.swapItemOrder.mockRejectedValue(new Error("db"));

    const req = buildReq({
      params: { itemId: "1" },
      body: { direction: "up" },
    });
    const res = buildRes();

    await controller.updateItemOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("deleteItemHandler", () => {
  test("returns 404 when item not found", async () => {
    playlistItemModel.deleteItem.mockResolvedValue(null);

    const req = buildReq({ params: { itemId: "1" } });
    const res = buildRes();

    await controller.deleteItemHandler(req, res);

    expect(playlistItemModel.deleteItem).toHaveBeenCalledWith(1, 10);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Item not found" });
  });

  test("deletes item on success", async () => {
    playlistItemModel.deleteItem.mockResolvedValue({ id: 1 });

    const req = buildReq({ params: { itemId: "1" } });
    const res = buildRes();

    await controller.deleteItemHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Item deleted successfully",
    });
  });

  test("returns 500 on error", async () => {
    playlistItemModel.deleteItem.mockRejectedValue(new Error("db"));

    const req = buildReq({ params: { itemId: "1" } });
    const res = buildRes();

    await controller.deleteItemHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
