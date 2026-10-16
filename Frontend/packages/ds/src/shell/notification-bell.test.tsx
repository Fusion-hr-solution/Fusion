import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell, relativeStamp, type NotificationBellItem } from "./notification-bell";

const now = new Date("2026-10-15T12:00:00Z");
const performance = { key: "performance", label: "Performance", status: "ready" as const };

function item(id: string, readAt: string | null = null): NotificationBellItem {
  return {
    id,
    module: "performance",
    title: `Nour submitted their plan ${id}`,
    context: "Ready for your review",
    actorName: "Nour Ben Ali",
    occurredAt: "2026-10-15T11:30:00Z",
    readAt,
  };
}

describe("NotificationBell", () => {
  it("marks unread notifications on the trigger", () => {
    render(
      <NotificationBell items={[item("1")]} unreadCount={1} modules={[performance]} onOpenItem={vi.fn()} onMarkAllRead={vi.fn()} now={now} />,
    );
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
    expect(screen.getByTestId("notification-unread-mark")).toBeInTheDocument();
  });

  it("shows a one-line empty state and no unread mark", async () => {
    render(<NotificationBell items={[]} unreadCount={0} modules={[performance]} onOpenItem={vi.fn()} onMarkAllRead={vi.fn()} now={now} />);
    expect(screen.queryByTestId("notification-unread-mark")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });

  it("names a module that failed to load", async () => {
    render(
      <NotificationBell
        items={[]}
        unreadCount={0}
        modules={[{ ...performance, status: "error" }]}
        onOpenItem={vi.fn()}
        onMarkAllRead={vi.fn()}
        now={now}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Performance notifications couldn't be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No notifications yet")).not.toBeInTheDocument();
  });

  it("opens an entry and offers to mark all read", async () => {
    const onOpenItem = vi.fn();
    const onMarkAllRead = vi.fn();
    render(
      <NotificationBell
        items={[item("1"), item("2", "2026-10-15T11:45:00Z")]}
        unreadCount={1}
        modules={[performance]}
        onOpenItem={onOpenItem}
        onMarkAllRead={onMarkAllRead}
        now={now}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByText("Nour submitted their plan 1"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("filters by module only when several modules serve notifications", async () => {
    const core = { key: "core", label: "Core HR", status: "ready" as const };
    render(
      <NotificationBell
        items={[item("1"), { ...item("2"), module: "core", title: "Core item" }]}
        unreadCount={2}
        modules={[performance, core]}
        onOpenItem={vi.fn()}
        onMarkAllRead={vi.fn()}
        now={now}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    await userEvent.click(screen.getByRole("button", { name: "Core HR" }));
    expect(screen.getByText("Core item")).toBeInTheDocument();
    expect(screen.queryByText("Nour submitted their plan 1")).not.toBeInTheDocument();
  });

  it("stamps time relatively", () => {
    expect(relativeStamp("2026-10-15T11:59:40Z", now)).toBe("now");
    expect(relativeStamp("2026-10-15T11:30:00Z", now)).toBe("30m");
    expect(relativeStamp("2026-10-14T09:00:00Z", now)).toBe("Yesterday");
  });
});
