import { describe, expect, it } from "vitest";
import type { OrgChartDto, OrgChartPersonDto } from "@repo/api";
import { G, buildTree, chainOf, createLens, isMore, layoutChart, litLine, moreId, searchPeople, stepFrom } from "./org-chart-model";

function person(key: string, managerKey: string | null, division: string | null = "d1", extra: Partial<OrgChartPersonDto> = {}): OrgChartPersonDto {
  return {
    employeeKey: key, displayName: key, initials: key.slice(0, 2).toUpperCase(), jobTitle: `${key} title`,
    unit: { id: `u-${key}`, name: `Unit ${key}`, divisionId: division, divisionName: division ? `Division ${division}` : null },
    workLocation: "Tunis", workEmail: `${key}@example.test`, startYear: 2022, isNew: false, managerKey,
    dottedLineManagerKeys: [], directCount: 0, totalCount: 0, ...extra,
  };
}

// Sami leads Amira (who leads Mariam → Aicha, Aymen) and Nour (no reports).
const chart: OrgChartDto = {
  asOf: "2026-10-27", scope: "Tenant", viewerKey: "Aicha", folded: [],
  people: [
    person("Sami", null, null), person("Amira", "Sami"), person("Nour", "Sami", "d2"),
    person("Mariam", "Amira"), person("Aicha", "Mariam"), person("Aymen", "Mariam"),
  ],
};

describe("org chart model", () => {
  const tree = buildTree(chart);

  it("builds the reporting tree and the chain above someone", () => {
    expect(tree.roots).toEqual(["Sami"]);
    expect(tree.kids.get("Sami")).toEqual(["Amira", "Nour"]);
    expect(chainOf(tree, "Aicha")).toEqual(["Sami", "Amira", "Mariam"]);
    expect([...litLine(tree, "Mariam")]).toEqual(["Sami", "Amira", "Mariam"]);
  });

  it("opens around you: the chain as pills above your manager's card, the team on the spine", () => {
    const layout = layoutChart(tree, { view: "focus", focus: "Aicha", folded: new Set(), unfolded: new Set() });
    expect(layout.root).toBe("Mariam");
    expect(layout.nodes.get("Sami")?.kind).toBe("chain");
    expect(layout.nodes.get("Amira")?.kind).toBe("chain");
    const mariam = layout.nodes.get("Mariam")!;
    const aicha = layout.nodes.get("Aicha")!;
    const aymen = layout.nodes.get("Aymen")!;
    expect(mariam.kind).toBe("lead");
    // Two people sit in two columns either side of the spine, on one row.
    expect(aicha.y).toBe(aymen.y);
    expect(aymen.x - (aicha.x + aicha.w)).toBe(G.SP);
    expect(layout.nodes.has("Nour")).toBe(false);
  });

  it("folds sub-teams around a leader until the viewer opens them", () => {
    const folded = layoutChart(tree, { view: "focus", focus: "Sami", folded: new Set(), unfolded: new Set() });
    expect([...folded.folded]).toEqual(["Amira"]);
    expect(folded.nodes.has("Mariam")).toBe(false);
    const open = layoutChart(tree, { view: "focus", focus: "Sami", folded: new Set(), unfolded: new Set(["Amira"]) });
    expect(open.nodes.has("Mariam")).toBe(true);
    expect(open.nodes.get("Sami")?.top).toBe(true);
  });

  it("lays out the whole company with every edge", () => {
    const layout = layoutChart(tree, { view: "company", focus: null, folded: new Set(), unfolded: new Set() });
    expect(layout.nodes.size).toBe(6);
    expect(layout.edges.map((e) => `${e.from}>${e.to}:${e.type}`).sort()).toEqual([
      "Amira>Mariam:tree", "Mariam>Aicha:fish", "Mariam>Aymen:fish", "Sami>Amira:tree", "Sami>Nour:down",
    ]);
  });

  it("counts people outside a manager's slice under the visible person they hang from", () => {
    const sliced = buildTree({ ...chart, scope: "DirectReports", people: chart.people.filter((p) => p.employeeKey !== "Nour"), folded: [{ parentKey: "Sami", count: 1 }] });
    expect(sliced.kids.get("Sami")).toEqual(["Amira", moreId("Sami")]);
    const layout = layoutChart(sliced, { view: "company", focus: null, folded: new Set(), unfolded: new Set() });
    expect(layout.nodes.get(moreId("Sami"))?.kind).toBe("more");
    expect(isMore(moreId("Sami"))).toBe(true);
  });

  it("colours divisions with identity hues, the top in amber, and only labels locations", () => {
    const division = createLens(tree, "division", "Leadership");
    expect(division("Sami")).toEqual({ key: "lead", label: "Leadership", color: "var(--primary)" });
    expect(division("Amira")).toEqual({ key: "d1", label: "Division d1", color: "var(--identity-1)" });
    expect(division("Nour")?.color).toBe("var(--identity-2)");
    expect(createLens(tree, "location", "Leadership")("Nour")).toEqual({ key: "Tunis", label: "Tunis", color: null });
    expect(createLens(tree, "none", "Leadership")("Nour")).toBeNull();
  });

  it("stops colouring with more than five divisions", () => {
    const many = buildTree({ ...chart, people: [person("Top", null, null), ...["a", "b", "c", "d", "e", "f"].map((d) => person(`P${d}`, "Top", d))] });
    expect(createLens(many, "division", "Leadership")("Pa")?.color).toBeNull();
  });

  it("finds people by name, title or unit, names first", () => {
    expect(searchPeople(tree, "ai").map((p) => p.employeeKey)).toEqual(["Aicha"]);
    expect(searchPeople(tree, "unit mariam").map((p) => p.employeeKey)).toEqual(["Mariam"]);
    expect(searchPeople(tree, "  ")).toEqual([]);
  });

  it("moves with the keyboard to the manager, the first report and peers", () => {
    expect(stepFrom(tree, "Aicha", "ArrowUp")).toBe("Mariam");
    expect(stepFrom(tree, "Mariam", "ArrowDown")).toBe("Aicha");
    expect(stepFrom(tree, "Aicha", "ArrowRight")).toBe("Aymen");
    expect(stepFrom(tree, "Aicha", "ArrowLeft")).toBe("Aymen");
    expect(stepFrom(tree, "Sami", "ArrowUp")).toBeNull();
  });
});
