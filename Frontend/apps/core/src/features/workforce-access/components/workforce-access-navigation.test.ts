import { describe, expect, it } from "vitest";
import { peopleProfilePath } from "./workforce-access-navigation";

describe("Workforce Access People links", () => {
  it("uses the canonical stable employee key expected by the People route", () => {
    expect(peopleProfilePath("4d00b2cc-d85a-46b6-9973-cc8051dd798d")).toBe(
      "/core/people/4d00b2cc-d85a-46b6-9973-cc8051dd798d"
    );
  });

  it("preserves the missing-email recovery intent and safe return path", () => {
    expect(
      peopleProfilePath("E-KEY-1", {
        action: "work-email",
        returnTo: "/core/workforce-access",
      })
    ).toBe(
      "/core/people/E-KEY-1?action=work-email&returnTo=%2Fcore%2Fworkforce-access"
    );
  });
});
