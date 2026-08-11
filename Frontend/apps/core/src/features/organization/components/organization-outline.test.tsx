// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { buildOrganizationHierarchy } from "../model/hierarchy";
import { asteriaHierarchy } from "../test/fixtures";
import { OrganizationOutline } from "./organization-outline";

describe("Organization Outline", () => {
  it("preserves hierarchy semantics and keyboard selection", () => {
    const onSelect = vi.fn();
    render(
      <OrganizationOutline
        model={buildOrganizationHierarchy(asteriaHierarchy)}
        collapsed={new Set()}
        selectedId="technology"
        canManage
        readOnly={false}
        onSelect={onSelect}
        onToggle={vi.fn()}
        onAddChild={vi.fn()}
        onStageDragMove={vi.fn()}
      />
    );

    const technology = screen.getByRole("row", {
      name: /Technology, Division, code TECH, under Asteria Group \/ Consulting/i,
    });
    expect(technology).toHaveAttribute("aria-level", "3");
    expect(technology).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(technology, { key: "ArrowDown" });
    const dataAndAi = screen.getByRole("row", { name: /Data & AI, Team, code DAI/i });
    expect(dataAndAi).toHaveFocus();
    fireEvent.keyDown(dataAndAi, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("data-ai");
  });

  it("hides mutation actions but keeps rows selectable in a read-only temporal view", () => {
    const onSelect = vi.fn();
    render(
      <OrganizationOutline
        model={buildOrganizationHierarchy(asteriaHierarchy)}
        collapsed={new Set()}
        selectedId={null}
        canManage
        readOnly
        onSelect={onSelect}
        onToggle={vi.fn()}
        onAddChild={vi.fn()}
        onStageDragMove={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Add child/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Drag to move Technology/i })).not.toBeInTheDocument();

    // Read-only removes mutation, not inspection: rows stay selectable.
    fireEvent.click(screen.getByRole("button", { name: "Technology" }));
    expect(onSelect).toHaveBeenCalledWith("technology");
  });
});
