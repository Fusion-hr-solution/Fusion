import { describe, expect, it } from "vitest";
import type { OrgChartDto, OrgChartPersonDto } from "@repo/api";
import {
  G, buildTree, chainOf, createLens, isMore, layoutChart, litLine, monthTicks, moreId, replaySteps, searchPeople, stepFrom, timeWindow,
  type LensWords,
} from "./org-chart-model";

const words: LensWords = {
  leadership: "Leadership",
  tenure: ["Under a year", "1 to 3 years", "3 to 5 years", "5 years or more"],
  span: ["1 to 3 direct", "4 to 7 direct", "8 or more direct"],
};
const lens = (tree: ReturnType<typeof buildTree>, key: Parameters<typeof createLens>[1]) => createLens(tree, key, words, "2026-10-27");

function person(key: string, managerKey: string | null, division: string | null = "d1", extra: Partial<OrgChartPersonDto> = {}): OrgChartPersonDto {
  return {
    employeeKey: key, displayName: key, initials: key.slice(0, 2).toUpperCase(), jobTitle: `${key} title`,
    unit: { id: `u-${key}`, name: `Unit ${key}`, divisionId: division, divisionName: division ? `Division ${division}` : null },
    workLocation: "Tunis", workEmail: `${key}@example.test`, startYear: 2022, startDate: null, isNew: false, managerKey,
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
    const division = lens(tree, "division");
    expect(division("Sami")).toEqual({ key: "lead", label: "Leadership", color: "var(--primary)" });
    expect(division("Amira")).toEqual({ key: "d1", label: "Division d1", color: "var(--identity-1)" });
    expect(division("Nour")?.color).toBe("var(--identity-2)");
    expect(lens(tree, "location")("Nour")).toEqual({ key: "Tunis", label: "Tunis", color: null });
    expect(lens(tree, "none")("Nour")).toBeNull();
  });

  it("stops colouring with more than five divisions", () => {
    const many = buildTree({ ...chart, people: [person("Top", null, null), ...["a", "b", "c", "d", "e", "f"].map((d) => person(`P${d}`, "Top", d))] });
    expect(lens(many, "division")("Pa")?.color).toBeNull();
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

  it("brings HR's upcoming joiners in as ghosts and flags the first change coming for each person", () => {
    const joiner = person("Skander", null, "d1", { directCount: 9 });
    const ahead = buildTree(chart, [
      { kind: "Leave", date: "2026-11-30", employeeKey: "Nour", managerKey: null, person: null },
      { kind: "Join", date: "2026-11-17", employeeKey: "Skander", managerKey: "Mariam", person: joiner },
      { kind: "Move", date: "2026-12-01", employeeKey: "Nour", managerKey: "Amira", person: null },
      { kind: "Join", date: "2026-11-20", employeeKey: "Ghost", managerKey: "Nobody", person: person("Ghost", null) },
    ]);
    expect([...ahead.ghosts]).toEqual(["Skander"]);
    expect(ahead.kids.get("Mariam")).toEqual(["Aicha", "Aymen", "Skander"]);
    expect(ahead.flags.get("Skander")).toEqual({ kind: "join", date: "2026-11-17", managerKey: "Mariam" });
    expect(ahead.flags.get("Nour")).toEqual({ kind: "leave", date: "2026-11-30", managerKey: null });
    expect(ahead.people.has("Ghost")).toBe(false);
  });

  it("buckets tenure from the full start date and span of control from direct reports", () => {
    const hr = buildTree({
      ...chart,
      people: [
        person("Sami", null, null, { startDate: "2018-05-07", directCount: 9 }),
        person("Amira", "Sami", "d1", { startDate: "2026-03-01", directCount: 2 }),
        person("Nour", "Sami", "d1", { startDate: "2023-01-01" }),
      ],
    });
    expect(lens(hr, "tenure")("Sami")).toMatchObject({ key: "t3", label: "5 years or more" });
    expect(lens(hr, "tenure")("Amira")?.key).toBe("t0");
    expect(lens(hr, "tenure")("Nour")?.key).toBe("t2");
    expect(lens(hr, "span")("Sami")).toMatchObject({ key: "s2", label: "8 or more direct" });
    expect(lens(hr, "span")("Amira")?.key).toBe("s0");
    expect(lens(hr, "span")("Nour")).toBeNull();
    expect(lens(tree, "tenure")("Sami")).toBeNull(); // no start date outside HR
  });

  it("frames the time bar like the canvas and replays by quarter", () => {
    expect(timeWindow("2026-10-27")).toEqual({ lo: "2026-01-01", hi: "2026-12-31" });
    expect(monthTicks("2026-01-01", "2026-12-31", "2026-10-27")).toEqual(["2026-02-01", "2026-04-01", "2026-06-01", "2026-08-01", "2026-12-01"]);
    expect(replaySteps("2025-05-07", "2026-01-15")).toEqual(["2025-05-07", "2025-07-01", "2025-10-01", "2026-01-01", "2026-01-15"]);
    expect(replaySteps("2026-10-27", "2026-10-27")).toEqual(["2026-10-27"]);
  });
});
