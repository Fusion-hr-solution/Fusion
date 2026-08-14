import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../types";
import { ApiError } from "../types";
import {
  coreOrganizationImportQueryKeys,
  createCoreOrganizationImportApi,
  translateOrganizationImportError,
} from "../core-organization-import";

describe("Organization Import contracts", () => {
  it("uploads retained source context as FormData without client-authored authority fields", async () => {
    const post = vi.fn().mockResolvedValue({ kind: "SourceReady" });
    const client = {
      get: vi.fn(),
      post,
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
    const api = createCoreOrganizationImportApi(client);
    const file = new File(["Name\nRoot"], "organization.csv", { type: "text/csv" });

    await api.intake({
      file,
      effectiveDate: "2026-08-12",
      creationToken: "b18c8f1d-6a0f-401a-a974-bd64551bf600",
      selectedSheetName: "Organization",
    });

    const body = post.mock.calls[0]?.[1] as FormData;
    expect(post.mock.calls[0]?.[0]).toBe("/corehr/organization/imports/intake");
    expect(body.get("file")).toBe(file);
    expect(body.get("effectiveDate")).toBe("2026-08-12");
    expect(body.get("creationToken")).toBe("b18c8f1d-6a0f-401a-a974-bd64551bf600");
    expect(body.get("selectedSheetName")).toBe("Organization");
    expect(body.has("tenantId")).toBe(false);
    expect(body.has("status")).toBe(false);
    expect(body.has("sourceTable")).toBe(false);
  });

  it("sends quoted optimistic concurrency for date changes and discard", async () => {
    const patch = vi.fn().mockResolvedValue({});
    const post = vi.fn().mockResolvedValue({});
    const api = createCoreOrganizationImportApi({
      get: vi.fn(), post, put: vi.fn(), patch, delete: vi.fn(),
    } as unknown as ApiClient);

    await api.changeEffectiveDate("session-1", 7, "2026-09-01");
    await api.discard("session-1", 8);

    expect(patch).toHaveBeenCalledWith(
      "/corehr/organization/imports/session-1/effective-date",
      { effectiveDate: "2026-09-01" },
      { headers: { "If-Match": '"7"' } }
    );
    expect(post).toHaveBeenCalledWith(
      "/corehr/organization/imports/session-1/discard",
      undefined,
      { headers: { "If-Match": '"8"' } }
    );
  });

  it("sends only bounded decisions and the reviewed digest with optimistic concurrency", async () => {
    const put = vi.fn().mockResolvedValue({});
    const post = vi.fn().mockResolvedValue({});
    const api = createCoreOrganizationImportApi({
      get: vi.fn(), post, put, patch: vi.fn(), delete: vi.fn(),
    } as unknown as ApiClient);

    await api.replaceDecisions("session-1", 9, { introducedRoot: { name: "Asteria", businessCode: "ASTERIA" } });
    await api.commit("session-1", 10, "digest");

    expect(put).toHaveBeenCalledWith(
      "/corehr/organization/imports/session-1/decisions",
      { decisions: { introducedRoot: { name: "Asteria", businessCode: "ASTERIA" } } },
      { headers: { "If-Match": '"9"' } }
    );
    expect(post).toHaveBeenCalledWith(
      "/corehr/organization/imports/session-1/commit",
      { semanticDigest: "digest" },
      { headers: { "If-Match": '"10"' } }
    );
  });

  it("keeps active and durable caches in one bounded namespace", () => {
    expect(coreOrganizationImportQueryKeys.active()).toEqual(["coreOrganizationImport", "active"]);
    expect(coreOrganizationImportQueryKeys.session("session-1")).toEqual([
      "coreOrganizationImport", "session", "session-1",
    ]);
  });

  it("translates source and stale-write failures without parsing prose", () => {
    expect(translateOrganizationImportError(
      new ApiError(422, "Unprocessable", ["Choose another file."], null, null, "UnsafeWorkbookContent")
    )).toMatchObject({ kind: "rejected", code: "UnsafeWorkbookContent" });
    expect(translateOrganizationImportError(
      new ApiError(409, "Conflict", ["Refresh."], null, null, "ConcurrencyConflict")
    )).toMatchObject({ kind: "concurrency" });
    expect(translateOrganizationImportError(
      new ApiError(413, "Payload Too Large", ["Response is not valid JSON"], null)
    )).toEqual({
      kind: "rejected",
      code: null,
      message: "Choose a file no larger than 10 MB.",
    });
  });
});
