import { describe, expect, it } from "vitest";
import { resolveDirectionView } from "./direction-view";

describe("organization direction view", () => {
  it("opens on the map for everyone", () => {
    expect(resolveDirectionView(null, true)).toBe("map");
    expect(resolveDirectionView(null, false)).toBe("map");
  });

  it("offers the list only to direction authority", () => {
    expect(resolveDirectionView("list", true)).toBe("list");
    expect(resolveDirectionView("list", false)).toBe("map");
  });
});
