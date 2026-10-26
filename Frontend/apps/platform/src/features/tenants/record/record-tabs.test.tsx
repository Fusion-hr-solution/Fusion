import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderInArabic, renderInFrench } from "@/test/intl";
import { aTenant, anEvent, anInvitation } from "@/test/fixtures";
import type { TenantContinuityHealth } from "../api";
import { TenantAccessDestination } from "./access-page";
import { TenantActivityDestination } from "./activity-page";
import { TenantProductsDestination } from "./products-page";

const record = vi.hoisted(() => ({
  tenant: null as unknown,
  continuity: null as unknown,
}));

vi.mock("./record-shell", () => ({
  useTenantRecord: () => ({
    tenant: record.tenant,
    query: "",
    from: null,
    refresh: () => {},
    isRefreshing: false,
  }),
}));
vi.mock("../queries", () => ({
  useTenantContinuityHealth: () => ({
    data: record.continuity,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useInvitationRecovery: () => ({
    mutateAsync: vi.fn(),
    isLoading: false,
    error: null,
  }),
  useInitiateAdministratorRecovery: () => ({
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
}));

function continuity(
  overrides: Partial<TenantContinuityHealth> = {}
): TenantContinuityHealth {
  return {
    usableAdministrators: 2,
    activeAdministrators: 2,
    suspendedAdministrators: 0,
    pendingAdministratorInvitations: 1,
    recoveryStatus: "NotRequired",
    latestRecoveryAttempt: null,
    ...overrides,
  };
}

describe("The tenant record tabs", () => {
  it("reads Access in French, with the recoveries the invitation allows", () => {
    record.tenant = aTenant({ bootstrapInvitation: anInvitation() });
    record.continuity = continuity();

    renderInFrench(<TenantAccessDestination />);

    expect(
      screen.getByRole("heading", { name: "Administrateur initial" })
    ).toBeInTheDocument();
    expect(screen.getByText("admin@atlas.example")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Renvoyer l’invitation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Révoquer l’invitation" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Peuvent se connecter").nextSibling
    ).toHaveTextContent("2");
    expect(screen.getByText("Autonome")).toBeInTheDocument();
  });

  it("offers an archived tenant no invitation or recovery action", () => {
    record.tenant = aTenant({
      isActive: false,
      isArchived: true,
      bootstrapInvitation: anInvitation({ allowedActions: [] }),
    });
    record.continuity = continuity({
      usableAdministrators: 0,
      recoveryStatus: "Required",
    });

    renderInFrench(<TenantAccessDestination />);

    expect(
      screen.queryByRole("button", { name: "Renvoyer l’invitation" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Lancer la récupération" })
    ).not.toBeInTheDocument();
  });

  it("reads Products in Arabic, with who granted them", () => {
    record.tenant = aTenant({
      modules: ["CoreHR", "Performance"],
      history: [
        anEvent("TenantProvisioned", "2026-08-01T09:00:00Z", {
          actorName: "Admin Platform",
        }),
      ],
    });

    renderInArabic(<TenantProductsDestination />);

    expect(
      screen.getByRole("heading", { name: "المنتجات" })
    ).toBeInTheDocument();
    expect(screen.getByText("2 من 6 منتجات مستخدمة")).toBeInTheDocument();
    expect(
      screen.getAllByText("بواسطة Admin Platform عند الإنشاء")
    ).toHaveLength(2);
  });

  it("reads Activity in French, with who acted", () => {
    record.tenant = aTenant({
      history: [
        anEvent("TenantArchived", "2026-10-26T09:00:00Z", {
          actorName: "Admin Platform",
        }),
        anEvent("TenantProvisioned", "2026-08-01T09:00:00Z"),
      ],
    });

    renderInFrench(<TenantActivityDestination />);

    expect(screen.getByText("2 événements")).toBeInTheDocument();
    expect(screen.getByText("Organisation archivée")).toBeInTheDocument();
    expect(screen.getByText(/Par Admin Platform/)).toBeInTheDocument();
    expect(screen.getByText(/Par Fusion Platform/)).toBeInTheDocument();
  });
});
