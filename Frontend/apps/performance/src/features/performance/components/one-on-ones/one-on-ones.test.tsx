// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OneOnOneMeetingDto, OneOnOneRowDto, OneOnOneSeriesDto, OneOnOnesDto } from "@repo/api";
import { OneOnOnesWorkspace } from "./one-on-ones-workspace";
import { SeriesRecord } from "./series-record";

const command = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isLoading: false, error: null });
const state = vi.hoisted(() => ({
  list: null as unknown,
  series: null as unknown,
  start: null as unknown,
  startMutate: null as unknown as ReturnType<typeof vi.fn>,
  commands: {} as Record<string, { mutate: ReturnType<typeof vi.fn>; mutateAsync: ReturnType<typeof vi.fn>; isLoading: boolean }>,
}));
vi.mock("../../api/use-conversations", () => ({
  useOneOnOnes: () => ({ data: state.list, isLoading: false, error: null, refetch: vi.fn() }),
  useOneOnOne: () => ({ data: state.series, isLoading: false, error: null, refetch: vi.fn() }),
  useOneOnOneStart: () => ({ data: state.start, isLoading: false, error: null }),
  useOneOnOneCommands: () => state.commands,
  useStartOneOnOne: () => ({ mutateAsync: state.startMutate, isLoading: false, error: null }),
}));
vi.mock("../../api/use-performance", () => ({ usePersonSummary: () => ({ data: undefined, isLoading: false, error: null }) }));
vi.mock("@repo/auth", () => ({ useAuth: () => ({ user: { employeeId: "nour", fullName: "Nour Trabelsi" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const nour = { employeeId: "nour", displayName: "Nour Trabelsi", jobTitle: "Engineer" };
const karim = { employeeId: "karim", displayName: "Karim Haddad", jobTitle: "Engineering manager" };
const soon = new Date(Date.now() + 2 * 3_600_000).toISOString();
const later = new Date(Date.now() + 9 * 86_400_000).toISOString();

function row(overrides: Partial<OneOnOneRowDto> = {}): OneOnOneRowDto {
  return { seriesId: "s1", with: nour, cadence: "Weekly", nextMeetingAt: later, openActions: 0, overdueActions: 0,
    ended: false, endedAt: null, nextMeetingId: "m1", agendaCount: 0, lastMetAt: null, recent: [], ...overrides };
}

function list(overrides: Partial<OneOnOnesDto> = {}): OneOnOnesDto {
  return { withManager: null, startWithManager: null, reports: [], startWithReports: [], ended: [], defaultCadence: "EveryTwoWeeks",
    lineAvailable: true, myActions: [], ...overrides };
}

function meeting(overrides: Partial<OneOnOneMeetingDto> = {}): OneOnOneMeetingDto {
  return { id: "m1", version: 2, scheduledAt: "2030-01-08T10:00:00Z", state: "Upcoming", completedAt: null, agenda: [], sharedNotes: "",
    sharedNotesRevision: 0, privateNote: { text: "", revision: 0 }, notesWritable: true, actions: [], suggestions: [], ...overrides };
}

function series(overrides: Partial<OneOnOneSeriesDto> = {}): OneOnOneSeriesDto {
  return { id: "s1", version: 1, manager: karim, report: nour, viewerRole: "Manager", cadence: "Weekly", startedAt: "2029-12-01T10:00:00Z",
    startedByEmployeeId: "karim", ended: false, endedAt: null, endReason: null, upcoming: meeting(), past: [], openActions: 0,
    overdueActions: 0, can: { write: true, complete: true }, ...overrides };
}

beforeEach(() => {
  state.series = series();
  state.start = { with: karim, defaultCadence: "EveryTwoWeeks", suggestions: [] };
  state.startMutate = vi.fn(async () => ({ id: "s9" }));
  state.commands = Object.fromEntries(
    ["changeCadence", "reschedule", "complete", "addAgendaItem", "setDiscussed", "removeAgendaItem", "setSharedNotes", "setPrivateNotes",
      "addAction", "setActionDone"].map((name) => [name, command()]),
  );
});

describe("1:1s workspace", () => {
  it("leads with the next conversation, then the team's rhythm, and offers to start the rest", () => {
    state.list = list({
      withManager: row({ seriesId: "s3", with: karim, nextMeetingAt: later }),
      reports: [
        row({ seriesId: "s1", with: nour, nextMeetingAt: soon, openActions: 2, overdueActions: 1 }),
        row({ seriesId: "s2", with: { employeeId: "sami", displayName: "Sami Kefi", jobTitle: null } }),
      ],
      startWithReports: [{ with: { employeeId: "rim", displayName: "Rim Mahjoub", jobTitle: null } }],
    });
    render(<OneOnOnesWorkspace />);
    const next = screen.getByRole("heading", { name: "Nour Trabelsi", level: 2 }).closest("section")!;
    expect(within(next).getByRole("link", { name: /Open 1:1/ }).getAttribute("href")).toBe("/one-on-ones/s1");
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/one-on-ones/s2")).toBe(true);
    expect(screen.getByText(/1 overdue/)).toBeTruthy();
    const rim = screen.getByText("Rim Mahjoub").closest("li")!;
    fireEvent.click(within(rim).getByRole("button", { name: "Start 1:1s" }));
    expect(screen.getByRole("dialog").textContent).toContain("1:1s with Rim Mahjoub");
  });

  it("lists the actions the caller owes across series", () => {
    state.list = list({
      reports: [row()],
      myActions: [{ seriesId: "s1", actionId: "a1", text: "Book the vendor review", with: nour, dueDate: "2020-01-01", overdue: true }],
    });
    render(<OneOnOnesWorkspace />);
    expect(screen.getByText("Book the vendor review").closest("a")!.getAttribute("href")).toBe("/one-on-ones/s1");
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("makes starting with the manager the page, with the first agenda picked from the year", async () => {
    state.list = list({ startWithManager: { with: karim } });
    state.start = {
      with: karim,
      defaultCadence: "EveryTwoWeeks",
      suggestions: [{ kind: "Objective", sourceId: "o1", cycleId: "c1", label: "Ship the gateway", status: "AtRisk", href: "/x", at: null }],
    };
    render(<OneOnOnesWorkspace />);
    expect(screen.getByRole("heading", { name: "1:1s with Karim Haddad" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Put Ship the gateway on the first agenda" }).getAttribute("data-state")).toBe("checked");
    fireEvent.click(screen.getByRole("button", { name: "Start 1:1s" }));
    await vi.waitFor(() => expect(state.startMutate).toHaveBeenCalled());
    const request = state.startMutate.mock.calls[0]![0] as { withEmployeeId: string; agenda: { sourceKind?: string; sourceId?: string }[] };
    expect(request.withEmployeeId).toBe("karim");
    expect(request.agenda).toEqual([expect.objectContaining({ sourceKind: "Objective", sourceId: "o1" })]);
  });
});

describe("series record", () => {
  it("completes the next meeting from the header with its version", () => {
    render(<SeriesRecord seriesId="s1" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Nour Trabelsi");
    fireEvent.click(screen.getByRole("button", { name: "Complete meeting" }));
    expect(state.commands.complete!.mutate).toHaveBeenCalledWith({ meetingId: "m1", expectedVersion: 2 });
  });

  it("adds a suggestion by its source and marks carried actions", () => {
    state.series = series({
      upcoming: meeting({
        suggestions: [{ kind: "Objective", sourceId: "o1", cycleId: "c1", label: "Integrate the vendor API", status: "AtRisk", href: "/x", at: null }],
        actions: [{ id: "a1", text: "Send the vendor draft", ownerEmployeeId: "nour", dueDate: null, done: false, doneAt: null,
          createdInMeetingId: "m0", createdInMeetingAt: "2029-12-25T10:00:00Z", createdByEmployeeId: "karim", carriedOver: true, overdue: false }],
      }),
    });
    render(<SeriesRecord seriesId="s1" />);
    expect(screen.getByRole("heading", { name: /From Nour's year/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Integrate the vendor API to the talking points" }));
    expect(state.commands.addAgendaItem!.mutate).toHaveBeenCalledWith({
      meetingId: "m1",
      request: expect.objectContaining({ sourceKind: "Objective", sourceId: "o1" }),
    });
    expect(screen.getByText("From 25 Dec")).toBeTruthy();
  });

  it("keeps the private note under its own label, apart from the shared notes", () => {
    render(<SeriesRecord seriesId="s1" />);
    expect(screen.getByLabelText("Shared with Nour")).toBeTruthy();
    expect(screen.getByLabelText("Only you")).toBeTruthy();
  });

  it("offers no edits on an ended series and opens its last meeting", () => {
    state.series = series({
      ended: true,
      endedAt: "2030-01-10T10:00:00Z",
      endReason: "ReportingLineEnded",
      upcoming: null,
      can: { write: false, complete: false },
      past: [meeting({ id: "m0", state: "Completed", notesWritable: false, sharedNotes: "Agreed the plan" })],
    });
    render(<SeriesRecord seriesId="s1" />);
    expect(screen.queryByRole("button", { name: "Complete meeting" })).toBeNull();
    expect(screen.queryByLabelText("Add a talking point")).toBeNull();
    expect(screen.getAllByText(/^Ended/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Last meeting" })).toBeTruthy();
    expect(screen.getByText("Agreed the plan")).toBeTruthy();
  });
});
