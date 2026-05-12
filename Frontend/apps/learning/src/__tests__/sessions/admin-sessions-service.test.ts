import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  }),
}));

import {
  getPartsForTraining,
  addPart,
  updatePart,
  deletePart,
  reorderParts,
  getSessions,
  addSession,
  cancelSession,
  duplicateSession,
} from "@/services/admin-sessions-service";

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
});

describe("admin-sessions-service", () => {
  it("getPartsForTraining hits the nested parts endpoint", async () => {
    mockGet.mockResolvedValueOnce([]);
    await getPartsForTraining("training-1");
    expect(mockGet).toHaveBeenCalledWith("/training/admin/trainings/training-1/parts");
  });

  it("addPart POSTs the input", async () => {
    mockPost.mockResolvedValueOnce("part-id");
    const id = await addPart("training-1", { title: "P1", durationHours: 2 });
    expect(id).toBe("part-id");
    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/trainings/training-1/parts",
      { title: "P1", durationHours: 2 },
    );
  });

  it("updatePart PUTs to the part endpoint", async () => {
    mockPut.mockResolvedValueOnce(undefined);
    await updatePart("t1", "p1", { title: "New", durationHours: 3 });
    expect(mockPut).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/parts/p1",
      { title: "New", durationHours: 3 },
    );
  });

  it("deletePart DELETEs the part endpoint", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    await deletePart("t1", "p1");
    expect(mockDelete).toHaveBeenCalledWith("/training/admin/trainings/t1/parts/p1");
  });

  it("reorderParts PUTs the partIds array", async () => {
    mockPut.mockResolvedValueOnce(undefined);
    await reorderParts("t1", ["p1", "p2"]);
    expect(mockPut).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/parts/reorder",
      { partIds: ["p1", "p2"] },
    );
  });

  it("getSessions sends filters as query params", async () => {
    mockGet.mockResolvedValueOnce({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await getSessions({ trainingId: "t1", status: "Planned", page: 2, pageSize: 50 });
    expect(mockGet).toHaveBeenCalledWith("/training/admin/sessions", {
      params: { trainingId: "t1", status: "Planned", page: 2, pageSize: 50 },
    });
  });

  it("addSession posts to the part-scoped endpoint", async () => {
    mockPost.mockResolvedValueOnce({ sessionId: "s1", roomConflicts: [] });
    const result = await addSession("t1", "p1", {
      startUtc: "2025-04-10T09:00:00Z",
      endUtc: "2025-04-10T12:00:00Z",
      room: "Room A",
      maxCapacity: 25,
    });
    expect(result.sessionId).toBe("s1");
    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/parts/p1/sessions",
      expect.objectContaining({ room: "Room A", maxCapacity: 25 }),
    );
  });

  it("cancelSession posts the reason", async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await cancelSession("s1", { reason: "Trainer ill" });
    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/sessions/s1/cancel",
      { reason: "Trainer ill" },
    );
  });

  it("duplicateSession posts the duplicate input", async () => {
    mockPost.mockResolvedValueOnce({ createdSessionIds: ["s2"], roomConflicts: [] });
    const r = await duplicateSession("s1", { newStartUtc: "2025-04-17T09:00:00Z", occurrences: 1, intervalDays: 7 });
    expect(r.createdSessionIds).toEqual(["s2"]);
    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/sessions/s1/duplicate",
      { newStartUtc: "2025-04-17T09:00:00Z", occurrences: 1, intervalDays: 7 },
    );
  });
});
