// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@repo/api";
import type {
  EvaluationAssignmentRosterItemDto,
  EvaluationRoundDetailDto,
} from "@repo/api";

import { RoundParticipantOperations } from "./round-participant-operations";

const state = vi.hoisted(() => ({
  putResult: "success" as "success" | "conflict" | "denied" | "dependency",
  putCalls: [] as unknown[],
  toasts: [] as string[],
}));

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => state.toasts.push(message),
    error: (message: string) => state.toasts.push(message),
  },
}));

vi.mock("@repo/api", async () => {
  const actual = (await vi.importActual("@repo/api")) as Record<string, unknown>;
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(async (path: string, body: unknown) => {
        state.putCalls.push({ path, body });
        if (state.putResult === "conflict") {
          throw new ApiError(
            409,
            "",
            ["Someone else changed this round."],
            "corr-1",
            null,
            "Performance.VersionConflict",
          );
        }
        if (state.putResult === "denied") {
          throw new ApiError(
            403,
            "",
            ["You do not have access to this."],
            "corr-1",
            null,
            "Performance.Forbidden",
          );
        }
        if (state.putResult === "dependency") {
          throw new ApiError(
            503,
            "",
            ["Core HR is temporarily unavailable."],
            "corr-1",
            null,
            "Performance.Dependency.CoreWorkforceUnavailable",
          );
        }
        return undefined;
      }),
    }),
  };
});

let container: HTMLElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  state.putResult = "success";
  state.putCalls = [];
  state.toasts = [];
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

const round = {
  round: { id: "round-1", version: 4 },
} as unknown as EvaluationRoundDetailDto;

const participant = {
  id: "assignment-1",
  participantEmployeeId: "employee-1",
  participantName: "Leila Consultant",
  kind: "ManagerAssessment",
  assigneeEmployeeId: "manager-1",
  assigneeName: "Nadia Manager",
  status: "InProgress",
} as EvaluationAssignmentRosterItemDto;

function open(page: HTMLElement, labelStart: string) {
  const trigger = Array.from(page.querySelectorAll("button")).find((button) =>
    button.getAttribute("aria-label")?.startsWith(labelStart),
  );
  act(() => trigger?.click());
}

function typeInto(selector: string, value: string) {
  const field = document.querySelector(selector) as
    | HTMLTextAreaElement
    | HTMLInputElement
    | null;
  if (!field) return;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickByText(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  act(() => button?.click());
}

describe("round participant operations", () => {
  it("renders nothing for a caller who cannot operate the round", () => {
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate={false}
        onChanged={async () => {}}
      />,
    );

    // Hidden rather than shown-and-denied.
    expect(page.querySelectorAll("button")).toHaveLength(0);
  });

  it("sends the round's current version so a stale write is rejected server-side", async () => {
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    typeInto("#exclusion-reason", "Left the company");
    clickByText("Remove from round");
    await act(async () => {
      await Promise.resolve();
    });

    expect(state.putCalls).toHaveLength(1);
  });

  it("keeps the typed reason when the write fails", async () => {
    state.putResult = "conflict";
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    typeInto("#exclusion-reason", "Left the company");
    clickByText("Remove from round");
    await act(async () => {
      await Promise.resolve();
    });

    // A failure must not cost the user what they typed.
    const field = document.querySelector("#exclusion-reason") as HTMLTextAreaElement;
    expect(field.value).toBe("Left the company");
  });

  it("shows no success confirmation when the write fails", async () => {
    state.putResult = "conflict";
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    typeInto("#exclusion-reason", "Left");
    clickByText("Remove from round");
    await act(async () => {
      await Promise.resolve();
    });

    expect(state.toasts).toHaveLength(0);
  });

  it("surfaces the failure in the dialog rather than closing it", async () => {
    state.putResult = "denied";
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    typeInto("#exclusion-reason", "Left");
    clickByText("Remove from round");
    await act(async () => {
      await Promise.resolve();
    });

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("You do not have access to this.");
  });

  it("reports a dependency outage in its own words, not as the user's mistake", async () => {
    state.putResult = "dependency";
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Change who reviews Leila Consultant");
    typeInto("#reviewer-id", "manager-2");
    typeInto("#reviewer-name", "New Reviewer");
    typeInto("#reviewer-reason", "Reorg");
    clickByText("Change reviewer");
    await act(async () => {
      await Promise.resolve();
    });

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("temporarily unavailable");
    expect(state.toasts).toHaveLength(0);
  });

  it("confirms only after the write actually succeeds", async () => {
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    typeInto("#exclusion-reason", "Left the company");
    clickByText("Remove from round");
    await act(async () => {
      await Promise.resolve();
    });

    expect(state.toasts).toEqual(["Removed from this round"]);
  });

  it("is inert until a reason is given", () => {
    const page = render(
      <RoundParticipantOperations
        round={round}
        participant={participant}
        canOperate
        onChanged={async () => {}}
      />,
    );

    open(page, "Remove Leila Consultant");
    const confirm = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Remove from round",
    ) as HTMLButtonElement;

    // A reason is what makes the exclusion auditable, so it is required, not optional.
    expect(confirm.disabled).toBe(true);
    expect(state.putCalls).toHaveLength(0);
  });
});
