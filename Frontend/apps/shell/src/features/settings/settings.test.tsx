// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationPreferences } from "@repo/api";
import { Notifications } from "./notifications";
import { Preferences } from "./preferences";

const mocks = vi.hoisted(() => ({
  theme: "light",
  setTheme: vi.fn(),
  locale: "en",
  setLocale: vi.fn(),
  preferences: undefined as NotificationPreferences | undefined,
  mutate: vi.fn(),
}));

vi.mock("@repo/ds/shell", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTheme: () => ({ theme: mocks.theme, setTheme: mocks.setTheme }),
  useFusionLocale: () => [mocks.locale, mocks.setLocale, true],
}));

vi.mock("@repo/api/query", () => ({
  useNotificationPreferences: () => ({
    data: mocks.preferences,
    isPending: !mocks.preferences,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateNotificationPreferences: () => ({ mutate: mocks.mutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Preferences", () => {
  it("binds appearance to the device theme and confirms with Saved", () => {
    render(<Preferences />);
    expect(screen.getByRole("heading", { level: 1, name: "Preferences" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("status").textContent).toContain("Saved");
  });

  it("offers Match this device and English or Français", () => {
    render(<Preferences />);
    fireEvent.click(screen.getByRole("radio", { name: "Match this device" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("system");
    fireEvent.click(screen.getByRole("radio", { name: "Français" }));
    expect(mocks.setLocale).toHaveBeenCalledWith("fr");
  });
});

const PREFERENCES: NotificationPreferences = {
  emailAddress: "aicha.bouazizi@example.test",
  version: 4,
  groups: [
    {
      key: "plans-and-goals",
      label: "Plans and goals",
      summary: "Your plan approved or returned, updates asked of you, development goals added",
      email: true,
      locked: false,
      count: 4,
      items: [{ label: "Your plan approved or returned", team: false, always: false, count: 2 }],
    },
    {
      key: "one-on-ones",
      label: "1:1s",
      summary: "A 1:1 started or moved, actions assigned to you",
      email: false,
      locked: false,
      count: 3,
      items: [{ label: "A 1:1 started or moved", team: false, always: false, count: 2 }],
    },
    {
      key: "reviews-and-calibration",
      label: "Reviews and calibration",
      summary: "Reviews to write, peers to approve, your own review",
      email: true,
      locked: false,
      count: 13,
      items: [
        { label: "A review to write opens", team: true, always: false, count: 1 },
        { label: "A review of yours is due tomorrow or late", team: false, always: true, count: 1 },
      ],
    },
    {
      key: "deadline-reminders",
      label: "Deadline reminders",
      summary: "Something of yours is due soon or late",
      email: true,
      locked: true,
      count: 1,
      items: [{ label: "A review of yours is due tomorrow or late", team: false, always: true, count: 1 }],
    },
  ],
};

describe("Notifications", () => {
  it("shows where email goes, a switch per group and reminders always emailed", () => {
    mocks.preferences = PREFERENCES;
    render(<Notifications />);
    expect(screen.getByText("aicha.bouazizi@example.test")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Email for Plans and goals" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Email for 1:1s" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("switch", { name: "Email for Deadline reminders" })).not.toBeTruthy();
    expect(screen.getAllByText("Always").length).toBeGreaterThan(0);
  });

  it("saves the whole set of groups turned off when one switch changes", () => {
    mocks.preferences = PREFERENCES;
    render(<Notifications />);
    fireEvent.click(screen.getByRole("switch", { name: "Email for Plans and goals" }));
    expect(mocks.mutate).toHaveBeenCalledWith(
      { expectedVersion: 4, emailOff: ["plans-and-goals", "one-on-ones"] },
      expect.anything(),
    );
  });

  it("opens a group to its notifications, marking the team's", () => {
    mocks.preferences = PREFERENCES;
    render(<Notifications />);
    fireEvent.click(screen.getByRole("button", { name: /Reviews and calibration/ }));
    expect(screen.getByText("13 notifications")).toBeTruthy();
    const row = screen.getByText("A review to write opens").closest("li")!;
    expect(within(row).getByText("Your team")).toBeTruthy();
  });
});
