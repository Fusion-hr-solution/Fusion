"use client";

import { translateOrganizationImportError } from "@repo/api";
import { useMatchEdit as useSharedMatchEdit } from "@/features/data-import/components/match-table";
import { useOrganizationImportMutations } from "../api/use-organization-import";
import { useImportFrame } from "./import-frame";

export {
  COLUMN_GRID,
  TYPE_GRID,
  MappingHead,
  MappingSection,
  MappingStatusPill,
} from "@/features/data-import/components/match-table";

type MatchChange = Omit<Parameters<ReturnType<typeof useOrganizationImportMutations>["updateMatch"]["mutateAsync"]>[0], "id" | "version">;

/** Edits the Organization Mapping Plan against the attempt's current version. */
export function useMatchEdit() {
  const { session } = useImportFrame();
  const { updateMatch } = useOrganizationImportMutations();
  return useSharedMatchEdit<MatchChange>(
    (change) => updateMatch.mutateAsync({ id: session.id, version: session.version, ...change }),
    (error) => translateOrganizationImportError(error).message
  );
}
