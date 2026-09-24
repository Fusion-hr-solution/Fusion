"use client";

import { toast } from "sonner";
import { PageContainer } from "@repo/ds/shell";
import { translateOrganizationImportError } from "@repo/api";
import { useOrganizationImportMutations } from "../api/use-organization-import";
import { useImportFrame } from "./import-frame";
import { MatchAssistance } from "./match-assistance";
import { MatchColumnMapping } from "./match-column-mapping";
import { MatchFooter } from "./match-footer";
import { MatchTypeMeaning } from "./match-type-meaning";
import { MatchFilePreview } from "./match-file-preview";
import { MatchNextSteps } from "./match-next-steps";
import { MatchStatusSummary } from "./match-status-summary";
import { MatchSummaryBanner } from "./match-summary-banner";

/**
 * Match: resolving what the file's columns and terms mean for Organization. Being rebuilt
 * piece by piece; the stage, its route and its readiness rules stay in place.
 */
export function MatchStage() {
  const { session } = useImportFrame();
  const { runSemanticAssistance } = useOrganizationImportMutations();
  const match = session.match;
  const table = session.source.table;
  const running = runSemanticAssistance.isLoading;

  async function runAssistance(grantTenantConsent: boolean) {
    const inputFingerprint = match?.semanticAssistance?.inputFingerprint;
    if (!inputFingerprint) return;
    try {
      await runSemanticAssistance.mutateAsync({ id: session.id, inputFingerprint, grantTenantConsent });
    } catch (error) {
      toast.error("Automatic matching didn't run", {
        description: translateOrganizationImportError(error).message,
      });
    }
  }

  return (
    <section aria-label="Match">
      <PageContainer className="space-y-6 pt-2">
        {match ? (
          <MatchSummaryBanner match={match}>
            <MatchAssistance
              assistance={match.semanticAssistance}
              needsReview={match.readiness.requiredDecisions.length}
              running={running}
              onRun={(grant) => void runAssistance(grant)}
            />
          </MatchSummaryBanner>
        ) : null}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
          <div className="min-w-0 space-y-6">
            {match && table ? (
              <>
                <MatchColumnMapping table={table} match={match} locked={running} />
                <MatchTypeMeaning match={match} locked={running} />
              </>
            ) : null}
          </div>
          <aside className="min-w-0 space-y-6">
            {match && table ? (
              <>
                <MatchFilePreview table={table} match={match} />
                <MatchStatusSummary table={table} match={match} />
              </>
            ) : null}
            {match ? <MatchNextSteps match={match} /> : null}
          </aside>
        </div>
      </PageContainer>
      {match ? <MatchFooter sessionId={session.id} match={match} busy={running} /> : null}
    </section>
  );
}
