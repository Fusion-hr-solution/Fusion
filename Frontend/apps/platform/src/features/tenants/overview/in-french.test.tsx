import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInFrench, sayInFrench } from "@/test/intl";
import type { TenantActivityEntry, TenantOverviewRow } from "../api";
import { tenantWords } from "../language";
import { activationSummary } from "./tenant-activation";
import { activityNarrative, activityTimestamp } from "./tenant-activity-language";
import { toCsv } from "./tenant-export";
import { TenantSummaryCards } from "./tenant-summary-cards";

const french = tenantWords(sayInFrench("tenants"), "fr");

const entry = (over: Partial<TenantActivityEntry> = {}): TenantActivityEntry => ({
  eventType: "TenantProvisioned",
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantName: "Northwind Tunisia",
  occurredAt: "2026-08-01T10:42:00Z",
  outcome: "Succeeded",
  actorName: null,
  ...over,
});

describe("The tenants list in French", () => {
  it("names the lifecycle cards in French, with French numbers", () => {
    renderInFrench(
      <TenantSummaryCards
        counts={{ all: 1204, awaitingActivation: 3, active: 1199, needsAttention: 2 }}
        selected="All"
        isLoading={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole("group", { name: "Filtrer les organisations par étape" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /À traiter/ })).toHaveTextContent("Invitation à rétablir");
    // Read raw: toHaveTextContent folds the narrow no-break space into a plain one.
    expect(screen.getByRole("button", { name: /Organisations/ }).textContent).toContain("1\u202f204");
  });

  it("splits a French sentence around the tenant's name", () => {
    const narrative = activityNarrative(
      entry({ eventType: "InvitationDeliveryAttempted", outcome: "Failed" }),
      french
    );

    expect(narrative.title).toBe("Échec de l’envoi de l’invitation");
    expect(narrative.before).toBe("L’invitation de l’administrateur de ");
    expect(narrative.after).toBe(" n’a pas pu être remise.");
    expect(narrative.isFailure).toBe(true);
  });

  it("says when in French", () => {
    const now = new Date(2026, 7, 1, 18, 0);
    expect(activityTimestamp(new Date(2026, 7, 1, 10, 42).toISOString(), now, french)).toBe("Aujourd’hui à 10:42");
    expect(activityTimestamp(new Date(2026, 6, 31, 9, 5).toISOString(), now, french)).toBe("Hier à 9:05");
  });

  it("words a row's activation and the export in French", () => {
    const row: TenantOverviewRow = {
      tenantId: "t1",
      name: "Atlas",
      initialAdministratorEmail: "admin@atlas.example",
      administratorActivationStatus: "AwaitingAdministratorActivation",
      invitationState: "Expired",
      lastDeliveryOutcome: "Sent",
      attentionReason: "InvitationExpired",
      needsAttention: true,
      modules: ["CoreHR"],
      createdAt: "2026-08-01T09:00:00Z",
      bootstrapInvitationId: null,
      allowedActions: [],
    };

    expect(activationSummary(row, french)).toEqual({
      status: "En attente d’activation de l’administrateur",
      detail: "Expirée · À réémettre",
      isException: true,
    });
    expect(toCsv([row], french).split("\r\n")[0]).toBe(
      '"Organisation","Statut de l’organisation","Administrateur initial","Statut de l’invitation","Résultat de l’envoi","Modules activés","Créée le"'
    );
  });
});
