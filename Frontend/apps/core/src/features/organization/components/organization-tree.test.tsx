// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { OrganizationHierarchyNodeDto } from "@repo/api";
import { OrganizationTree } from "./organization-tree";

function unit(id: string, name: string, path: string) {
  return {
    id,
    code: id,
    name,
    typeId: "t",
    typeName: "Unit",
    parentId: null,
    parentName: null,
    path,
    lifecycleState: "Active" as const,
    effectiveFrom: "2026-01-01",
    version: 1,
  };
}

const roots: OrganizationHierarchyNodeDto[] = [
  {
    unit: unit("root", "Asteria Group", "Asteria Group"),
    children: [
      { unit: unit("cs", "Customer Success", "Asteria Group / Customer Success"), children: [] },
      { unit: unit("growth", "Customer Growth", "Asteria Group / Customer Growth"), children: [] },
    ],
  },
];

describe("OrganizationTree", () => {
  it("hides child units until their branch is expanded, then reveals them", () => {
    render(<OrganizationTree roots={roots} selectedId={null} onSelect={() => {}} autoFocusSearch={false} />);

    expect(screen.getByText("Asteria Group")).toBeInTheDocument();
    expect(screen.queryByText("Customer Success")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Customer Success")).toBeInTheDocument();
    expect(screen.getByText("Customer Growth")).toBeInTheDocument();
  });

  it("selects a unit by id", () => {
    const onSelect = vi.fn();
    render(<OrganizationTree roots={roots} selectedId={null} onSelect={onSelect} autoFocusSearch={false} />);
    fireEvent.click(screen.getByText("Asteria Group"));
    expect(onSelect).toHaveBeenCalledWith("root");
  });

  it("searches across the whole tree with parent-path context, flattened", () => {
    render(<OrganizationTree roots={roots} selectedId={null} onSelect={() => {}} autoFocusSearch={false} />);
    fireEvent.change(screen.getByLabelText("Search organization"), { target: { value: "growth" } });
    // Deep match surfaces without expanding, with its ancestry line.
    expect(screen.getByText("Customer Growth")).toBeInTheDocument();
    expect(screen.getByText("Asteria Group")).toBeInTheDocument();
    expect(screen.queryByText("Customer Success")).toBeNull();
  });

  it("offers an all-option that clears the selection", () => {
    const onSelect = vi.fn();
    render(
      <OrganizationTree roots={roots} selectedId="root" onSelect={onSelect} allOption={{ label: "All organizations" }} autoFocusSearch={false} />
    );
    fireEvent.click(screen.getByText("All organizations"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
