import { describe, expect, it } from "vitest";
import type { WorkforceAccessSubjectSummaryDto } from "@repo/api";
import {
  selectionScopePeople,
  shouldOfferScopeEscalation,
} from "./workforce-access-selection";

const person = (
  employeeId: string,
  accessState: WorkforceAccessSubjectSummaryDto["accessState"]
) => ({ employeeId, accessState }) as WorkforceAccessSubjectSummaryDto;

describe("Workforce Access cross-page selection", () => {
  it("keeps the default state at page selection only", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: false,
        scopeSelected: false,
        scopeLoading: false,
        pageCount: 10,
        scopeCount: 415,
      })
    ).toBe(false);
  });

  it("offers escalation after the current page is selected", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: false,
        scopeLoading: false,
        pageCount: 10,
        scopeCount: 415,
      })
    ).toBe(true);
  });

  it("uses the server-resolved scope and preserves its count across pages", () => {
    const scope = [
      ...Array.from({ length: 10 }, (_, index) =>
        person(`page-${index}`, "NotInvited")
      ),
      ...Array.from({ length: 405 }, (_, index) =>
        person(`other-${index}`, "InvitePending")
      ),
      person("already-active", "ActiveAccount"),
    ];
    const selectedScope = selectionScopePeople(scope);

    expect(selectedScope).toHaveLength(415);
    expect(new Set(selectedScope.map((item) => item.employeeId)).size).toBe(
      415
    );
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: false,
        scopeLoading: false,
        pageCount: 10,
        scopeCount: selectedScope.length,
      })
    ).toBe(true);
  });

  it("stops offering escalation after the full scope is selected or while it is loading", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: true,
        scopeLoading: false,
        pageCount: 10,
        scopeCount: 415,
      })
    ).toBe(false);
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: false,
        scopeLoading: true,
        pageCount: 10,
        scopeCount: 415,
      })
    ).toBe(false);
  });

  it("does not offer escalation when the current view fits on one page", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: false,
        scopeLoading: false,
        pageCount: 7,
        scopeCount: 7,
      })
    ).toBe(false);
  });

  it("keeps the full-view state independent of the rendered page size", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: true,
        scopeLoading: false,
        pageCount: 10,
        scopeCount: 415,
      })
    ).toBe(false);
    expect(
      shouldOfferScopeEscalation({
        pageSelected: true,
        scopeSelected: true,
        scopeLoading: false,
        pageCount: 5,
        scopeCount: 415,
      })
    ).toBe(false);
  });

  it("returns to the normal roster state after selection is cleared", () => {
    expect(
      shouldOfferScopeEscalation({
        pageSelected: false,
        scopeSelected: false,
        scopeLoading: false,
        pageCount: 0,
        scopeCount: 0,
      })
    ).toBe(false);
  });

  it("returns only the established non-active selection semantics", () => {
    expect(
      selectionScopePeople([
        person("active", "ActiveAccount"),
        person("pending", "InvitePending"),
      ] as WorkforceAccessSubjectSummaryDto[])
    ).toHaveLength(1);
  });
});
