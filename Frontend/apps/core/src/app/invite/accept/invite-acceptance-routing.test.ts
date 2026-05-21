import { describe, expect, it } from "vitest";
import { resolveInviteAcceptanceDestination } from "./invite-acceptance-routing";

describe("resolveInviteAcceptanceDestination", () => {
  it("sends employees to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination({
        roles: ["Employee"],
        employeeId: "emp-1",
      })
    ).toBe("/profile");
  });

  it("sends managers to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination({
        roles: ["Manager"],
        employeeId: "emp-1",
      })
    ).toBe("/profile");
  });

  it("sends hr admins to setup summary", () => {
    expect(
      resolveInviteAcceptanceDestination({
        roles: ["HRAdmin"],
        employeeId: null,
      })
    ).toBe("/setup");
  });

  it("keeps platform admins on the admin workspace root", () => {
    expect(
      resolveInviteAcceptanceDestination({
        roles: ["PlatformAdmin"],
        employeeId: null,
      })
    ).toBe("/");
  });
});
