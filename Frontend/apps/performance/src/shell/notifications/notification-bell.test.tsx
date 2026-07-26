// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceNotificationDto } from "@repo/api";
import { activateNotification } from "./use-notifications";

const state = vi.hoisted(() => ({
  user: { employeeId: "emp-1" } as { employeeId: string | null } | null,
  unreadCount: 0,
  notifications: [] as PerformanceNotificationDto[],
  markReadCalls: [] as string[],
  markAllReadCalls: 0,
  pushCalls: [] as string[],
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: state.user, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (route: string) => state.pushCalls.push(route) }),
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }),
  };
});

let mutationCall = 0;
vi.mock("@repo/api/query", () => ({
  useApiQuery: (queryKey: unknown, _fn: unknown) => {
    const key = JSON.stringify(queryKey ?? []);
    if (key.includes("unread-count")) {
      return { data: state.unreadCount, error: null, isLoading: false, isFetching: false, refetch: vi.fn(), invalidate: vi.fn() };
    }
    return {
      data: { items: state.notifications, totalCount: state.notifications.length, page: 1, pageSize: 20, totalPages: 1, hasNextPage: false },
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    };
  },
  useApiMutation: () => {
    const isMarkRead = mutationCall % 2 === 0;
    mutationCall += 1;
    return {
      mutate: (arg: string) => (isMarkRead ? state.markReadCalls.push(arg) : (state.markAllReadCalls += 1)),
      mutateAsync: vi.fn(),
      isLoading: false,
    };
  },
}));

// Imported after mocks so the component picks up the mocked modules.
const { NotificationBell } = await import("./notification-bell");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container = null;
  state.user = { employeeId: "emp-1" };
  state.unreadCount = 0;
  state.notifications = [];
  state.markReadCalls = [];
  state.markAllReadCalls = 0;
  state.pushCalls = [];
  mutationCall = 0;
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function notification(overrides: Partial<PerformanceNotificationDto> = {}): PerformanceNotificationDto {
  return {
    id: "n1",
    type: "PlanApproved",
    title: "Your plan was approved",
    message: "Manager approved your objective plan.",
    cycleId: "c1",
    subjectType: "EmployeeObjectivePlan",
    subjectId: "p1",
    navigationRoute: "/my-objectives",
    createdAt: new Date().toISOString(),
    readAt: null,
    isRead: false,
    ...overrides,
  };
}

describe("NotificationBell", () => {
  it("renders nothing when the user has no employee identity", () => {
    state.user = { employeeId: null };
    const el = render(<NotificationBell />);
    expect(el.querySelector("button")).toBeNull();
  });

  it("shows an unread badge reflecting the count", () => {
    state.unreadCount = 3;
    const el = render(<NotificationBell />);
    const trigger = el.querySelector("button[aria-label]");
    expect(trigger?.getAttribute("aria-label")).toContain("3 unread");
    expect(el.textContent).toContain("3");
  });

  it("caps the badge at 9+", () => {
    state.unreadCount = 42;
    const el = render(<NotificationBell />);
    expect(el.textContent).toContain("9+");
  });
});

describe("activateNotification", () => {
  it("marks an unread notification read and deep-links", () => {
    const markRead = vi.fn();
    const navigate = vi.fn();
    activateNotification(notification(), { markRead, navigate });
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).toHaveBeenCalledWith("/my-objectives");
  });

  it("does not mark an already-read notification read, but still navigates", () => {
    const markRead = vi.fn();
    const navigate = vi.fn();
    activateNotification(notification({ isRead: true, readAt: new Date().toISOString() }), { markRead, navigate });
    expect(markRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/my-objectives");
  });

  it("marks read without navigating when there is no route", () => {
    const markRead = vi.fn();
    const navigate = vi.fn();
    activateNotification(notification({ navigationRoute: null }), { markRead, navigate });
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).not.toHaveBeenCalled();
  });
});
