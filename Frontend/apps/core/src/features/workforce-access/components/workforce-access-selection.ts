import type { WorkforceAccessSubjectSummaryDto } from "@repo/api";

export function selectionScopePeople(
  people: WorkforceAccessSubjectSummaryDto[]
): WorkforceAccessSubjectSummaryDto[] {
  return people.filter((person) => person.accessState !== "ActiveAccount");
}

export function shouldOfferScopeEscalation({
  pageSelected,
  scopeSelected,
  scopeLoading,
  pageCount,
  scopeCount,
}: {
  pageSelected: boolean;
  scopeSelected: boolean;
  scopeLoading: boolean;
  pageCount: number;
  scopeCount: number;
}): boolean {
  return (
    pageSelected && !scopeSelected && !scopeLoading && scopeCount > pageCount
  );
}
