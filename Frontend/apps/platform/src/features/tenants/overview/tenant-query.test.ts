import { describe, expect, it } from "vitest";
import type { TenantModule } from "../api";
import {
  activeFilterCount,
  DEFAULT_QUERY,
  isQueryNarrowed,
  NO_ADVANCED_FILTERS,
  parseQuery,
  serializeQuery,
  withQueryChange,
} from "./tenant-query";

const CATALOGUE: TenantModule[] = ["CoreHR", "Performance"];

const parse = (search: string) =>
  parseQuery(new URLSearchParams(search), CATALOGUE);

describe("parseQuery", () => {
  it("reads an untouched URL as the default query", () => {
    expect(parse("")).toEqual(DEFAULT_QUERY);
  });

  it("restores every dimension of a shared link", () => {
    const query = parse(
      "filter=NeedsAttention&q=atlas&invitation=Pending&invitation=Expired&delivery=Failed&module=Performance&from=2026-01-01&to=2026-06-30&sort=NameAscending&page=3"
    );

    expect(query).toEqual({
      filter: "NeedsAttention",
      search: "atlas",
      invitationStates: ["Pending", "Expired"],
      deliveryOutcomes: ["Failed"],
      modules: ["Performance"],
      createdFrom: "2026-01-01",
      createdTo: "2026-06-30",
      sort: "NameAscending",
      page: 3,
    });
  });

  it("discards values the service would reject", () => {
    // A hand-edited or stale link must degrade to something real rather than
    // sending an unknown value on to the service.
    const query = parse(
      "filter=Nonsense&invitation=Nonsense&delivery=Maybe&module=Payroll&sort=Random&from=01-01-2026&page=-4"
    );

    expect(query.filter).toBe("All");
    expect(query.invitationStates).toEqual([]);
    expect(query.deliveryOutcomes).toEqual([]);
    expect(query.modules).toEqual([]);
    expect(query.sort).toBe("CreatedDescending");
    expect(query.createdFrom).toBeNull();
    expect(query.page).toBe(1);
  });
});

describe("serializeQuery", () => {
  it("writes nothing for an untouched workspace", () => {
    expect(serializeQuery(DEFAULT_QUERY)).toBe("");
  });

  it("round-trips every dimension", () => {
    const query = {
      ...DEFAULT_QUERY,
      filter: "Active" as const,
      search: "atlas",
      invitationStates: ["Pending" as const],
      deliveryOutcomes: ["Failed" as const],
      modules: ["Performance" as const],
      createdFrom: "2026-01-01",
      createdTo: "2026-06-30",
      sort: "NameDescending" as const,
      page: 2,
    };

    expect(parse(serializeQuery(query))).toEqual(query);
  });

  it("does not persist whitespace as a search", () => {
    expect(serializeQuery({ ...DEFAULT_QUERY, search: "   " })).toBe("");
  });
});

describe("activeFilterCount", () => {
  it("counts nothing when nothing is set", () => {
    expect(activeFilterCount(NO_ADVANCED_FILTERS)).toBe(0);
  });

  it("counts a date range once, because the operator set one range", () => {
    expect(
      activeFilterCount({
        ...NO_ADVANCED_FILTERS,
        createdFrom: "2026-01-01",
        createdTo: "2026-06-30",
      })
    ).toBe(1);
  });

  it("counts each selected value across dimensions", () => {
    expect(
      activeFilterCount({
        invitationStates: ["Pending", "Expired"],
        deliveryOutcomes: ["Failed"],
        modules: ["Performance"],
        createdFrom: null,
        createdTo: null,
      })
    ).toBe(4);
  });
});

describe("isQueryNarrowed", () => {
  it("separates an unfiltered workspace from a narrowed one", () => {
    expect(isQueryNarrowed(DEFAULT_QUERY)).toBe(false);
    expect(isQueryNarrowed({ ...DEFAULT_QUERY, filter: "Active" })).toBe(true);
    expect(isQueryNarrowed({ ...DEFAULT_QUERY, search: "atlas" })).toBe(true);
    expect(
      isQueryNarrowed({ ...DEFAULT_QUERY, modules: ["Performance"] })
    ).toBe(true);

    // Paging and sorting change what is shown, not which tenants match.
    expect(isQueryNarrowed({ ...DEFAULT_QUERY, page: 4 })).toBe(false);
    expect(isQueryNarrowed({ ...DEFAULT_QUERY, sort: "NameAscending" })).toBe(false);
  });
});

describe("withQueryChange", () => {
  it("returns to page 1 when the matching set changes", () => {
    const onPageFour = { ...DEFAULT_QUERY, page: 4 };

    expect(withQueryChange(onPageFour, { filter: "Active" }).page).toBe(1);
    expect(withQueryChange(onPageFour, { search: "atlas" }).page).toBe(1);
    expect(withQueryChange(onPageFour, { modules: ["Performance"] }).page).toBe(1);

    // Sorting reorders the same tenants, but page 4 of the old order is not
    // page 4 of the new one, so it resets too.
    expect(withQueryChange(onPageFour, { sort: "NameAscending" }).page).toBe(1);
  });

  it("keeps the page when the page is what changed", () => {
    expect(withQueryChange(DEFAULT_QUERY, { page: 3 }).page).toBe(3);
  });
});
