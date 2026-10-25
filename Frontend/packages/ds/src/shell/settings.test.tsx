import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FusionSidebar } from "./fusion-sidebar";
import { LastChange, SettingsPage, SettingsSaveBar } from "./settings";
import type { FusionSidebarProps, FusionSidebarSettings } from "./types";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

const settings: FusionSidebarSettings = {
  back: { href: "/core/people", label: "Core HR" },
  groups: [
    {
      key: "you",
      label: "You",
      status: "ready",
      sections: [
        { id: "preferences", label: "Preferences", path: "/settings", access: "manage" },
        { id: "notifications", label: "Notifications", path: "/settings/notifications", access: "manage" },
      ],
    },
    {
      key: "core",
      label: "Core HR",
      status: "ready",
      viewOnly: true,
      sections: [{ id: "employee-fields", label: "Employee fields", path: "/core/settings/employee-fields", access: "view" }],
    },
    { key: "performance", label: "Performance", status: "error", sections: [], retry: vi.fn() },
  ],
};

function renderSettings(props: Partial<FusionSidebarProps> = {}) {
  return render(
    <FusionSidebar
      mode="settings"
      settings={settings}
      tenantName="Carthage Digital Group"
      modules={[{ key: "core", label: "Core HR", href: "/core" }]}
      currentModuleKey="core"
      basePath="/core"
      activePath="/settings/employee-fields"
      person={{ name: "Sami Ferchichi", detail: "HR partner", onSignOut: vi.fn() }}
      {...props}
    />,
  );
}

describe("FusionSidebar in settings mode", () => {
  it("shows the way back, the groups in order and the person, without the switcher or Recent", () => {
    renderSettings({ recent: [{ label: "Omar Mansour", kind: "Person", href: "/core/people/o" }] });
    const nav = screen.getByRole("complementary", { name: "Fusion navigation" });
    expect(within(nav).getByRole("link", { name: "Back to Core HR" })).toHaveAttribute("href", "/core/people");
    expect(within(nav).getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual([
      "You",
      "Core HR, view only",
      "Performance",
    ]);
    expect(within(nav).queryByRole("button", { name: /Switch module|Core HR/ })).not.toBeInTheDocument();
    expect(within(nav).queryByText("Recent")).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /^Home/ })).not.toBeInTheDocument();
    expect(within(nav).getByText("Sami Ferchichi")).toBeInTheDocument();
  });

  it("marks the open section, links within the app by path and across apps by document", () => {
    renderSettings();
    const fields = screen.getByRole("link", { name: "Employee fields" });
    expect(fields).toHaveAttribute("aria-current", "page");
    expect(fields).toHaveAttribute("href", "/settings/employee-fields");
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute("href", "/settings");
  });

  it("shows a module that didn't load with Try again, keeping the others", () => {
    renderSettings();
    expect(screen.getByText("Didn't load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(settings.groups[2]!.retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Employee fields" })).toBeInTheDocument();
  });

  it("outside settings, remembers the page so Back can return to it", () => {
    window.history.replaceState(null, "", "/core/people?tab=all");
    render(
      <FusionSidebar
        modules={[{ key: "core", label: "Core HR", href: "/core" }]}
        currentModuleKey="core"
        basePath="/core"
        activePath="/people"
        person={{ name: "Amira Khelifi" }}
      />,
    );
    expect(window.sessionStorage.getItem("fusion.settings.back")).toBe("/core/people?tab=all");
  });
});

describe("Settings page parts", () => {
  it("names who changed the section last, or when it was set up", () => {
    const now = new Date("2026-10-24T10:00:00Z");
    const { rerender } = render(
      <LastChange change={{ actorName: "Amira Khelifi", at: "2026-09-01T09:00:00Z" }} now={now} />,
    );
    expect(screen.getByText(/changed it on 1 Sept? 2026/)).toBeInTheDocument();
    expect(screen.getByText("Amira Khelifi")).toBeInTheDocument();
    rerender(<LastChange setUpAt="2026-10-20T09:00:00Z" now={now} />);
    expect(screen.getByText(/Set up on 20 Oct 2026/)).toBeInTheDocument();
  });

  it("marks a view-only page and renders the title before values load", () => {
    const { rerender } = render(<SettingsPage title="Employee fields" viewOnly>rows</SettingsPage>);
    expect(screen.getByRole("heading", { level: 1, name: "Employee fields" })).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
    rerender(<SettingsPage title="Rating scale" loading>rows</SettingsPage>);
    expect(screen.getByRole("heading", { name: "Rating scale" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading settings")).toBeInTheDocument();
    expect(screen.queryByText("rows")).not.toBeInTheDocument();
  });
});

describe("SettingsSaveBar", () => {
  const handlers = { onDiscard: vi.fn(), onSave: vi.fn(), onReload: vi.fn() };

  it("stays away until something is staged", () => {
    const { container } = render(<SettingsSaveBar changes={0} {...handlers} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the changes, names the consequence and offers Discard and Save", () => {
    render(
      <SettingsSaveBar
        changes={1}
        consequence="New review rounds give managers 10 days. Rounds already created keep their dates."
        {...handlers}
      />,
    );
    expect(screen.getByText("1 change")).toBeInTheDocument();
    expect(screen.getByText(/New review rounds give managers 10 days/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handlers.onDiscard).toHaveBeenCalled();
    expect(handlers.onSave).toHaveBeenCalled();
  });

  it("names who saved first and offers Reload instead", () => {
    render(
      <SettingsSaveBar
        changes={1}
        conflict={{ actorName: "Amira Khelifi", section: "Reviews", at: new Date(Date.now() - 60_000).toISOString() }}
        {...handlers}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Amira Khelifi saved Reviews 1 min ago.");
    expect(screen.getByRole("alert")).toHaveTextContent("Reload to see their version; your change is lost.");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(handlers.onReload).toHaveBeenCalled();
  });
});
