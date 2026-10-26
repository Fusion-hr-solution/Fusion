import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInArabic, sayInArabic } from "@/test/intl";
import type { TenantOverviewRow } from "../api";
import { tenantWords } from "../language";
import { activationSummary } from "./tenant-activation";
import { TenantSummaryCards } from "./tenant-summary-cards";

const arabic = tenantWords(sayInArabic("tenants"), "ar");

describe("The tenants list in Arabic", () => {
  it("names the lifecycle cards in Arabic", () => {
    renderInArabic(
      <TenantSummaryCards
        counts={{ all: 1204, awaitingActivation: 3, active: 1199, needsAttention: 2 }}
        selected="All"
        isLoading={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole("group", { name: "تصفية المؤسسات حسب المرحلة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تحتاج إلى متابعة/ })).toHaveTextContent("يلزم استرجاع الدعوة");
  });

  it("words a row's activation in Arabic", () => {
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

    expect(activationSummary(row, arabic)).toEqual({
      status: "بانتظار تفعيل المسؤول",
      detail: "منتهية · يلزم إعادة الإصدار",
      isException: true,
    });
  });
});
