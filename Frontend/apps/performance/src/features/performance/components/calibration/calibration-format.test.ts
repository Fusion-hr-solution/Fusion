import { describe, expect, it } from "vitest";
import { bandLevels, bandRange, flagText, leniencyText, nearestLevel, readLocation, writeLocation } from "./calibration-format";

const scale = [1, 2, 3, 4, 5].map((value) => ({ value, label: `L${value}`, description: null }));

describe("calibration wording and bands", () => {
  it("words each flag from its facts", () => {
    expect(flagText({ kind: "RatingVsObjectives", attainment: 41.6, moved: null, cycle: null })).toBe("Top rating, 42% of objectives");
    expect(flagText({ kind: "RatingVsObjectives", attainment: 93, moved: null, cycle: null })).toBe("Bottom rating, 93% of objectives");
    expect(flagText({ kind: "MovedSinceLastCycle", attainment: null, moved: -2, cycle: "FY2026" })).toBe("Down 2 levels since FY2026");
    expect(leniencyText(0.83)).toBe("0.8 above the session");
    expect(leniencyText(-1.17)).toBe("1.2 below the session");
  });

  it("splits the scale into bands and proposes the nearer level of a two-level band", () => {
    const bands = bandLevels(scale, 2, 3);
    expect(bands.map(bandRange)).toEqual(["1–2", "3", "4–5"]);
    expect(nearestLevel(bands[2]!, 3)).toBe(4);
    expect(nearestLevel(bands[0]!, 3)).toBe(2);
    expect(nearestLevel(bands[2]!, 5)).toBe(5);
  });

  it("round-trips the view and filters through the address, and falls back without potential", () => {
    const location = { view: "nine-box" as const, filter: { manager: "m1", flagged: true, notDiscussed: false, q: " rim " } };
    const query = writeLocation(location);
    expect(query).toBe("?view=nine-box&manager=m1&flagged=true&q=rim");
    expect(readLocation(new URLSearchParams(query), true).view).toBe("nine-box");
    expect(readLocation(new URLSearchParams(query), false).view).toBe("people");
    expect(readLocation(new URLSearchParams(query), true).filter.manager).toBe("m1");
  });
});
