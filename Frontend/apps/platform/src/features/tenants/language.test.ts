import { describe, expect, it } from "vitest";
import { isFailureOutcome } from "./language";

/**
 * The service records success with two different words. Every surface that
 * decides whether something went wrong reads them through this one predicate,
 * so the two cannot drift apart again.
 */
describe("isFailureOutcome", () => {
  it("treats a delivered invitation as a success", () => {
    // Delivery attempts settle as Sent or Failed; everything else settles as
    // Succeeded. A check for Succeeded alone reported every delivered
    // invitation as a bounce.
    expect(isFailureOutcome("Sent")).toBe(false);
    expect(isFailureOutcome("Succeeded")).toBe(false);
  });

  it("treats the recorded failures as failures", () => {
    expect(isFailureOutcome("Failed")).toBe(true);
    expect(isFailureOutcome("Rejected")).toBe(true);
  });

  it("ignores casing and surrounding space", () => {
    expect(isFailureOutcome("  sent ")).toBe(false);
    expect(isFailureOutcome("SUCCEEDED")).toBe(false);
  });

  it("treats an unrecognised outcome as a failure", () => {
    // The conservative direction: an unexplained event shown as a problem
    // invites a look, whereas one shown as success is a false success.
    expect(isFailureOutcome("SomethingNewFromTheService")).toBe(true);
    expect(isFailureOutcome("")).toBe(true);
  });
});
