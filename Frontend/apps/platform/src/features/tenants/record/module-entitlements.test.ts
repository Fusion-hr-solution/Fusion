import { describe, expect, it } from "vitest";
import type { TenantDetail } from "../api";
import { ACCEPTED_MODULES, aTenant } from "@/test/fixtures";
import { buildModuleOptions } from "../provisioning/module-catalogue";
import { entitlementsFor } from "./module-entitlements";

function stateFor(detail: TenantDetail, key: string) {
  const entry = entitlementsFor(detail, buildModuleOptions(ACCEPTED_MODULES)).find(
    (candidate) => candidate.option.key === key
  );
  return entry ?? null;
}

describe("entitlementsFor", () => {
  it("separates included, enabled, disabled and unavailable", () => {
    const detail = aTenant();

    expect(stateFor(detail, "core")?.state).toBe("included");
    // The tenant could have Performance and does not — a decision about this
    // tenant, not a gap in the product.
    expect(stateFor(detail, "performance")?.state).toBe("disabled");
    // Recognised by Fusion, but provisioning does not accept it.
    expect(stateFor(detail, "learning")?.state).toBe("unavailable");
  });

  it("marks an optional module the tenant actually has as enabled", () => {
    const detail = aTenant({ modules: ["CoreHR", "Performance"] });

    expect(stateFor(detail, "performance")?.state).toBe("enabled");
  });

  it("gives every recognized Fusion module a state", () => {
    const entries = entitlementsFor(aTenant(), buildModuleOptions(ACCEPTED_MODULES));

    expect(entries).toHaveLength(6);
    expect(entries.map((entry) => entry.state).sort()).toEqual([
      "disabled",
      "included",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
  });

  it("reserves a setup state for Core HR alone", () => {
    const detail = aTenant({ modules: ["CoreHR", "Performance"] });

    expect(stateFor(detail, "core")?.setupState).toBe("Setup not started");
    // An optional module receiving a generic readiness label from Platform
    // would invent a lifecycle its owner never defined.
    expect(stateFor(detail, "performance")?.setupState).toBeNull();
    expect(stateFor(detail, "learning")?.setupState).toBeNull();
  });

  it("stops claiming a Core HR setup state once someone could have started it", () => {
    const detail = aTenant({ administratorActivationStatus: "Active" });

    expect(stateFor(detail, "core")?.state).toBe("included");
    expect(stateFor(detail, "core")?.setupState).toBeNull();
  });

  it("carries no module identifier for an unavailable module", () => {
    // Nothing a request could send, so an unsupported entitlement cannot be
    // submitted even by mistake.
    expect(stateFor(aTenant(), "learning")?.option.module).toBeNull();
  });
});
