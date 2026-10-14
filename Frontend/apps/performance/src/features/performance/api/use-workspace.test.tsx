// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RecordCycleScope, RecordCycleScopeProvider, useSelectedCycleId } from "./use-workspace";

const location = vi.hoisted(() => ({ pathname: "/reviews/review-1", search: "cycle=query-cycle" }));
vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

function CycleProbe() {
  return <output data-testid="cycle">{useSelectedCycleId() ?? "current"}</output>;
}

describe("record Cycle scope", () => {
  it("prefers the loaded record Cycle over a Cycle in the URL", async () => {
    render(
      <RecordCycleScopeProvider>
        <RecordCycleScope cycleId="record-cycle"><CycleProbe /></RecordCycleScope>
      </RecordCycleScopeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("cycle").textContent).toBe("record-cycle"));
  });

  it("falls back to the URL when no loaded record has registered a Cycle", () => {
    render(<RecordCycleScopeProvider><CycleProbe /></RecordCycleScopeProvider>);
    expect(screen.getByTestId("cycle").textContent).toBe("query-cycle");
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") && !entry.name.endsWith("performance-routes.ts") ? [path] : [];
  });
}

describe("record route literals", () => {
  it("keeps review-round and Cycle record addresses in performance-routes", () => {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const literal = /["'`]\/(?:reviews\/rounds\/|cycles\/|reviews\/\$\{)/;
    const offenders = sourceFiles(sourceRoot).filter((path) => literal.test(readFileSync(path, "utf8")));
    expect(offenders, offenders.map((path) => relative(sourceRoot, path)).join("\n")).toEqual([]);
  });
});
