import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WorkFocus, WorkList, dueLabel, selectFeaturedWork, type WorkListItem } from "./work-list";

const today = new Date(2026, 9, 15);
const modules = [
  { key: "core", label: "Core HR", status: "ready" as const },
  { key: "performance", label: "Performance", status: "ready" as const },
];

const selfAssessment: WorkListItem = {
  id: "performance:self-assessment:1",
  module: "performance",
  title: "Complete your self-assessment",
  context: "Mid-year",
  dueOn: "2026-10-17",
  href: "/performance/reviews/1",
};
const updateRequest: WorkListItem = {
  id: "performance:update-request:2",
  module: "performance",
  title: "Update progress on Ship the playbook",
  href: "/performance/cycles/c/objectives/o?mode=record",
};
const access: WorkListItem = {
  id: "core:access-not-invited:t",
  module: "core",
  title: "12 people don't have Fusion access yet",
  dueOn: "2026-10-20",
  href: "/core/workforce-access",
};

describe("selectFeaturedWork", () => {
  it("features the earliest due item over undated ones", () => {
    expect(selectFeaturedWork([updateRequest, access, selfAssessment])).toBe(selfAssessment);
  });

  it("features the first item when none is due", () => {
    expect(selectFeaturedWork([updateRequest, { ...access, dueOn: null }])).toBe(updateRequest);
    expect(selectFeaturedWork([])).toBeNull();
  });
});

describe("dueLabel", () => {
  it("reads days left and overdue", () => {
    expect(dueLabel("2026-10-15", today)).toBe("Due today");
    expect(dueLabel("2026-10-16", today)).toBe("Due tomorrow");
    expect(dueLabel("2026-10-17", today)).toBe("2 days left");
    expect(dueLabel("2026-10-13", today)).toBe("2 days overdue");
  });
});

describe("WorkFocus", () => {
  it("shows the module, title, days left and one action opening its path", () => {
    render(<WorkFocus item={selfAssessment} moduleLabel="Performance" today={today} />);
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Complete your self-assessment" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("days left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/performance/reviews/1");
  });
});

describe("WorkList", () => {
  it("lists items from several modules in the given order, each opening its path", () => {
    render(<WorkList items={[selfAssessment, access, updateRequest]} modules={modules} today={today} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/performance/reviews/1",
      "/core/workforce-access",
      "/performance/cycles/c/objectives/o?mode=record",
    ]);
    expect(within(links[0]!).getByText("2 days left")).toBeInTheDocument();
  });

  it("states that nothing needs the person", () => {
    render(<WorkList items={[]} modules={modules} today={today} />);
    expect(screen.getByText("Nothing needs you right now")).toBeInTheDocument();
  });

  it("keeps loaded items, a placeholder for a slow module and a line for a failed one", () => {
    render(
      <WorkList
        items={[selfAssessment]}
        modules={[
          { key: "core", label: "Core HR", status: "error" },
          { key: "performance", label: "Performance", status: "ready" },
          { key: "learning", label: "Learning", status: "loading" },
        ]}
        today={today}
      />,
    );
    expect(screen.getByRole("link", { name: /Complete your self-assessment/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading Learning work")).toBeInTheDocument();
    expect(screen.getByText("Core HR work couldn't be loaded")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs you right now")).not.toBeInTheDocument();
  });
});
