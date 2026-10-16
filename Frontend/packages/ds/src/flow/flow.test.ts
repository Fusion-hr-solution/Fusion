import { describe, expect, it } from "vitest";
import { anchorDelta, layoutTree } from ".";

describe("layoutTree", () => {
  const options = { nodeWidth: 100, nodeHeight: 40, nodesep: 10, ranksep: 60, margin: 0 };
  const fork = [
    { source: "a", target: "b" },
    { source: "a", target: "c" },
  ];

  it("puts roots on top and depth below", () => {
    const positions = layoutTree(["a", "b", "c"], fork, options);
    const a = positions.get("a")!;
    const b = positions.get("b")!;
    expect(b.y).toBe(positions.get("c")!.y);
    expect(b.y - a.y).toBe(40 + 60);
  });

  it("spreads siblings sideways by the node width and gap", () => {
    const positions = layoutTree(["a", "b", "c"], fork, options);
    expect(Math.abs(positions.get("c")!.x - positions.get("b")!.x)).toBe(100 + 10);
  });

  it("places every node apart even when sizes are one shared object", () => {
    const shared = { width: 100, height: 40 };
    const positions = layoutTree(["a", "b", "c", "d"], fork, {
      ...options,
      sizeOf: () => shared,
    });
    expect(new Set([...positions.values()].map((p) => `${p.x},${p.y}`)).size).toBe(4);
    expect(shared).toEqual({ width: 100, height: 40 });
  });

  it("honours per-node sizes and keeps centers aligned", () => {
    const positions = layoutTree(["a", "b"], [{ source: "a", target: "b" }], {
      ...options,
      sizeOf: (id) => (id === "b" ? { width: 50, height: 20 } : undefined),
    });
    expect(positions.get("a")!.x + 50).toBe(positions.get("b")!.x + 25);
  });
});

describe("anchorDelta", () => {
  it("moves the viewport by the node's shift at the current zoom", () => {
    expect(anchorDelta({ x: 100, y: 50 }, { x: 40, y: 80 }, 0.5)).toEqual({ dx: 30, dy: -15 });
  });

  it("is zero when the node did not move", () => {
    expect(anchorDelta({ x: 1, y: 2 }, { x: 1, y: 2 }, 2)).toEqual({ dx: 0, dy: 0 });
  });
});
