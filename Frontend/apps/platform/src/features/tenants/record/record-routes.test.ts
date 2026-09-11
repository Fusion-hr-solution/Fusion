import { describe, expect, it } from "vitest";
import { TENANT_ID } from "@/test/fixtures";
import {
  RECORD_DESTINATIONS,
  destinationHref,
  directoryHref,
  isActiveDestination,
  recordQuery,
} from "./record-routes";

describe("RECORD_DESTINATIONS", () => {
  it("keeps the order an operator learns once", () => {
    expect(RECORD_DESTINATIONS.map((entry) => entry.label)).toEqual([
      "Overview",
      "Access",
      "Products",
      "Activity",
    ]);
  });

  it("serves Overview from the tenant's base route", () => {
    expect(RECORD_DESTINATIONS[0]!.segment).toBe("");
    expect(destinationHref(TENANT_ID, "")).toBe(`/tenants/${TENANT_ID}`);
  });

  it("gives every destination a distinct segment", () => {
    const segments = RECORD_DESTINATIONS.map((entry) => entry.segment);
    expect(new Set(segments).size).toBe(segments.length);
  });
});

describe("recordQuery", () => {
  it("is empty when the operator arrived without a directory query", () => {
    expect(recordQuery(null)).toBe("");
  });

  it("re-encodes the directory query instead of splicing it in", () => {
    // Spliced raw, `?filter=NeedsAttention&sort=NameAscending` would be read as
    // the record's own parameters and the way back would be lost.
    expect(recordQuery("filter=NeedsAttention&sort=NameAscending")).toBe(
      "?from=filter%3DNeedsAttention%26sort%3DNameAscending"
    );
  });

  it("survives a round trip through URLSearchParams", () => {
    const original = "filter=NeedsAttention&search=atlas%20group&page=2";
    const parsed = new URLSearchParams(recordQuery(original));

    expect(parsed.get("from")).toBe(original);
  });
});

describe("directoryHref", () => {
  it("returns to the list the operator left", () => {
    expect(directoryHref("filter=NeedsAttention")).toBe(
      "/tenants?filter=NeedsAttention"
    );
  });

  it("returns to the unfiltered list when there was no query", () => {
    expect(directoryHref(null)).toBe("/tenants");
  });
});

describe("isActiveDestination", () => {
  it("matches through the shell's base path", () => {
    // The browser shows `/platform/...`; the app routes without it.
    expect(
      isActiveDestination(`/platform/tenants/${TENANT_ID}/activity`, TENANT_ID, "activity")
    ).toBe(true);
    expect(
      isActiveDestination(`/tenants/${TENANT_ID}/activity`, TENANT_ID, "activity")
    ).toBe(true);
  });

  it("marks exactly one destination active for any record route", () => {
    for (const active of RECORD_DESTINATIONS) {
      const pathname = `/platform${destinationHref(TENANT_ID, active.segment)}`;
      const matched = RECORD_DESTINATIONS.filter((candidate) =>
        isActiveDestination(pathname, TENANT_ID, candidate.segment)
      );

      expect(matched).toEqual([active]);
    }
  });

  it("does not mark Overview active on a nested destination", () => {
    // The base route is a prefix of every other, so a prefix test would.
    expect(
      isActiveDestination(`/platform/tenants/${TENANT_ID}/access`, TENANT_ID, "")
    ).toBe(false);
  });

  it("does not match another tenant's record", () => {
    expect(
      isActiveDestination("/platform/tenants/other-tenant/activity", TENANT_ID, "activity")
    ).toBe(false);
  });
});
