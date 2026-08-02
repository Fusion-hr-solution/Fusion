import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ActivationProgression,
  type ActivationPhase,
} from "./activation-progression";

const PHASES: ActivationPhase[] = [
  "pending-sent",
  "pending-delivery-failed",
  "blocked",
  "active",
];

const MILESTONES = ["Provisioned", "Administrator activation", "Active"];

/**
 * The three milestones, in order, with the condition each currently reports.
 *
 * Queried by role and by the milestone's own name rather than by element
 * position, so adding a caption or rearranging the markup does not fail a suite
 * about which conditions are shown.
 */
function milestoneStates(phase: ActivationPhase): string[] {
  render(<ActivationProgression phase={phase} />);

  return screen.getAllByRole("listitem").map((item, index) => {
    const text = item.textContent ?? "";
    // Whatever the item says beyond its own name is the condition.
    return text.replace(MILESTONES[index]!, "").trim();
  });
}

describe("ActivationProgression", () => {
  it("shows a delivered pending invitation as waiting on its recipient", () => {
    expect(milestoneStates("pending-sent")).toEqual([
      "Complete",
      "Waiting",
      "Pending",
    ]);
  });

  it("shows a failed delivery as needing action", () => {
    expect(milestoneStates("pending-delivery-failed")).toEqual([
      "Complete",
      "Action required",
      "Pending",
    ]);
  });

  it("shows an expired or revoked invitation as blocked", () => {
    expect(milestoneStates("blocked")).toEqual(["Complete", "Blocked", "Pending"]);
  });

  it("completes every milestone once the administrator has activated", () => {
    expect(milestoneStates("active")).toEqual([
      "Complete",
      "Complete",
      "Complete",
    ]);
  });

  it("never says 'Not started', which belongs to Core HR setup", () => {
    for (const phase of PHASES) {
      expect(milestoneStates(phase).join(" ")).not.toMatch(/not started/i);
    }
  });

  it("names the milestones without leaking domain vocabulary", () => {
    const { container } = render(<ActivationProgression phase="pending-sent" />);
    const text = container.textContent ?? "";

    expect(text).toContain("Provisioned");
    expect(text).toContain("Administrator activation");
    expect(text).toContain("Active");
    expect(text).not.toMatch(/bootstrap|superseded/i);
  });

  it("states an exceptional condition in words, not by colour alone", () => {
    render(<ActivationProgression phase="pending-delivery-failed" />);

    // The tint is reinforcement; the words are what carry the meaning.
    expect(screen.getAllByText("Action required").length).toBeGreaterThan(0);
  });
});
