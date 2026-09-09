"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@repo/auth";
import {
  createPerformanceApi,
  createPlatformApiClient,
  performanceQueryKeys,
  type AddPlanObjectiveRequest,
  type AlignObjectiveRequest,
  type ConfigureContributionRequest,
  type CreateCycleRequest,
  type CreateOrganizationalObjectiveRequest,
  type CreateStrategicObjectiveRequest,
  type CycleSettingsDto,
  type ExceptionalApprovePlanRequest,
  type PerformanceAccessDto,
  type PopulationDto,
  type ReturnPlanRequest,
  type SetPlanWeightsRequest,
  type SetPopulationRequest,
  type ProgressUpdateDto,
  type SubmitProgressRequest,
  type UpdateCycleRequest,
  type UpdateOrganizationalObjectiveRequest,
  type UpdatePlanObjectiveRequest,
  type UpdateStrategicObjectiveRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery, useApiQueryClient } from "@repo/api/query";
import { resolvePerformanceAccess } from "@/shell/performance-access";

function useApis() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useMemo(
    () => ({
      performance: createPerformanceApi(client),
    }),
    [client]
  );
}

/**
 * Performance capabilities for the current user, derived from the authenticated
 * session claims — the client twin of the backend access policy. This removes the
 * blocking `/performance/access` round-trip that used to gate the whole overview
 * waterfall: the same booleans the server computes are pure claims checks, so no
 * network call is needed to know what to show. The backend still enforces every
 * action; this only governs "hide, don't deny" rendering.
 *
 * The result shape matches the react-query hooks (`data`/`isLoading`/`error`/
 * `refetch`) so existing consumers read unchanged. `data` is undefined until the
 * session resolves, keeping the content region on its loading state — and never
 * exposing an access-dependent surface before the session is known.
 */
export function usePerformanceAccess(): {
  data: PerformanceAccessDto | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { user, isLoading } = useAuth();
  return useMemo(
    () => ({
      data: isLoading ? undefined : resolvePerformanceAccess(user),
      isLoading,
      error: null,
      refetch: () => undefined,
    }),
    [user, isLoading],
  );
}

export function useCycles(enabled = true) {
  const { performance } = useApis();
  return useApiQuery(performanceQueryKeys.cycles(), (signal) => performance.listCycles(signal), {
    enabled,
  });
}

export function useCycle(cycleId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.cycle(cycleId ?? "none"),
    (signal) => performance.getCycle(cycleId as string, signal),
    { enabled: Boolean(cycleId) }
  );
}

/**
 * The primary/current Cycle's composed detail in one read — no list→detail chain.
 * The server selects the primary Cycle with the same rule as selectPrimaryCycle,
 * so the overview obtains its landing data directly and can load the Cycle list
 * (for the switcher) in parallel rather than gated behind it.
 */
export function useCurrentCycle(enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.currentCycle(),
    (signal) => performance.getCurrentCycle(signal),
    { enabled }
  );
}

export function useSettings(enabled = true) {
  const { performance } = useApis();
  return useApiQuery(performanceQueryKeys.settings(), (signal) => performance.getSettings(signal), {
    enabled,
  });
}

export function useStrategy(cycleId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.strategy(cycleId ?? "none"),
    (signal) => performance.listStrategy(cycleId as string, signal),
    { enabled: Boolean(cycleId) }
  );
}

export function usePopulation(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.population(cycleId ?? "none"),
    (signal) => performance.getPopulation(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function useGoals(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.goals(cycleId ?? "none"),
    (signal) => performance.getGoals(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function useGoal(cycleId: string | null, objectiveId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.goal(cycleId ?? "none", objectiveId ?? "none"),
    (signal) => performance.getGoal(cycleId as string, objectiveId as string, signal),
    { enabled: Boolean(cycleId) && Boolean(objectiveId) }
  );
}

export function useGoalMutations(cycleId: string) {
  const { performance } = useApis();
  // Any goal mutation can change the graph and any node's detail, so invalidate the whole goals
  // area plus the current Cycle detail (counts on the overview).
  const invalidate = [
    { queryKey: performanceQueryKeys.goals(cycleId) },
    { queryKey: [...performanceQueryKeys.all(), "goal", cycleId] },
    { queryKey: performanceQueryKeys.cycle(cycleId) },
    { queryKey: performanceQueryKeys.currentCycle() },
  ];
  const create = useApiMutation(
    (request: CreateOrganizationalObjectiveRequest) => performance.createGoal(cycleId, request),
    { invalidateQueries: invalidate }
  );
  const update = useApiMutation(
    (args: { objectiveId: string; request: UpdateOrganizationalObjectiveRequest }) =>
      performance.updateGoal(cycleId, args.objectiveId, args.request),
    { invalidateQueries: invalidate }
  );
  const align = useApiMutation(
    (args: { objectiveId: string; request: AlignObjectiveRequest }) =>
      performance.alignGoal(cycleId, args.objectiveId, args.request),
    { invalidateQueries: invalidate }
  );
  const publish = useApiMutation((objectiveId: string) => performance.publishGoal(cycleId, objectiveId), {
    invalidateQueries: invalidate,
  });
  const configureContribution = useApiMutation(
    (args: { objectiveId: string; request: ConfigureContributionRequest }) =>
      performance.configureGoalContribution(cycleId, args.objectiveId, args.request),
    { invalidateQueries: invalidate }
  );
  const lockContribution = useApiMutation(
    (objectiveId: string) => performance.lockGoalContribution(cycleId, objectiveId),
    { invalidateQueries: invalidate }
  );
  const remove = useApiMutation((objectiveId: string) => performance.deleteGoal(cycleId, objectiveId), {
    invalidateQueries: invalidate,
  });
  return { create, update, align, publish, configureContribution, lockContribution, remove };
}

// ── Employee plans (Chunk C) ───────────────────────────────────────────────────

export function useMyPlan(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.myPlan(cycleId ?? "none"),
    (signal) => performance.getMyPlan(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function useAlignmentTargets(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.alignmentTargets(cycleId ?? "none"),
    (signal) => performance.getAlignmentTargets(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function usePlanReviews(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.planReviews(cycleId ?? "none"),
    (signal) => performance.getPlanReviews(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

/** The manager's people roster for a Cycle — every report enriched with real plan lifecycle + progress. */
export function useTeamRoster(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.teamRoster(cycleId ?? "none"),
    (signal) => performance.getTeamRoster(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function usePlanDetail(cycleId: string | null, planId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.planDetail(cycleId ?? "none", planId ?? "none"),
    (signal) => performance.getPlanDetail(cycleId as string, planId as string, signal),
    { enabled: Boolean(cycleId) && Boolean(planId) }
  );
}

/** Employee authoring: create/edit/weight/submit the caller's own plan. */
export function usePlanMutations(cycleId: string) {
  const { performance } = useApis();
  const invalidate = [
    { queryKey: performanceQueryKeys.myPlan(cycleId) },
    { queryKey: performanceQueryKeys.cycle(cycleId) },
    { queryKey: performanceQueryKeys.currentCycle() },
  ];
  const create = useApiMutation(() => performance.createMyPlan(cycleId), { invalidateQueries: invalidate });
  const addObjective = useApiMutation(
    (request: AddPlanObjectiveRequest) => performance.addPlanObjective(cycleId, request),
    { invalidateQueries: invalidate }
  );
  const updateObjective = useApiMutation(
    (args: { objectiveId: string; request: UpdatePlanObjectiveRequest }) =>
      performance.updatePlanObjective(cycleId, args.objectiveId, args.request),
    { invalidateQueries: invalidate }
  );
  const removeObjective = useApiMutation(
    (objectiveId: string) => performance.removePlanObjective(cycleId, objectiveId),
    { invalidateQueries: invalidate }
  );
  const setWeights = useApiMutation(
    (request: SetPlanWeightsRequest) => performance.setPlanWeights(cycleId, request),
    { invalidateQueries: invalidate }
  );
  const submit = useApiMutation(() => performance.submitPlan(cycleId), { invalidateQueries: invalidate });
  return { create, addObjective, updateObjective, removeObjective, setWeights, submit };
}

/** Manager/administrator decision: return, approve, or exceptionally approve a submitted plan. */
export function usePlanReviewMutations(cycleId: string, planId: string) {
  const { performance } = useApis();
  const invalidate = [
    { queryKey: performanceQueryKeys.planReviews(cycleId) },
    { queryKey: performanceQueryKeys.planDetail(cycleId, planId) },
    { queryKey: performanceQueryKeys.cycle(cycleId) },
    { queryKey: performanceQueryKeys.currentCycle() },
  ];
  const approve = useApiMutation(() => performance.approvePlan(cycleId, planId), { invalidateQueries: invalidate });
  const returnForRevision = useApiMutation(
    (request: ReturnPlanRequest) => performance.returnPlan(cycleId, planId, request),
    { invalidateQueries: invalidate }
  );
  const exceptionalApprove = useApiMutation(
    (request: ExceptionalApprovePlanRequest) => performance.exceptionalApprovePlan(cycleId, planId, request),
    { invalidateQueries: invalidate }
  );
  return { approve, returnForRevision, exceptionalApprove };
}

// ── Progress & contribution (Chunk D) ──────────────────────────────────────────

export function useObjectiveProgress(cycleId: string | null, objectiveId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.objectiveProgress(cycleId ?? "none", objectiveId ?? "none"),
    (signal) => performance.getObjectiveProgress(cycleId as string, objectiveId as string, signal),
    { enabled: Boolean(cycleId) && Boolean(objectiveId) }
  );
}

export function useContribution(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.contribution(cycleId ?? "none"),
    (signal) => performance.getContribution(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

export function useContributionDetail(cycleId: string | null, objectiveId: string | null) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.contributionDetail(cycleId ?? "none", objectiveId ?? "none"),
    (signal) => performance.getContributionDetail(cycleId as string, objectiveId as string, signal),
    { enabled: Boolean(cycleId) && Boolean(objectiveId) }
  );
}

/** Owner progress recording on one objective, plus evidence staging. Refreshes progress, plan, and contribution. */
export function useProgressMutations(cycleId: string, objectiveId: string) {
  const { performance } = useApis();
  const invalidate = [
    { queryKey: performanceQueryKeys.objectiveProgress(cycleId, objectiveId) },
    { queryKey: performanceQueryKeys.myPlan(cycleId) },
    { queryKey: performanceQueryKeys.contribution(cycleId) },
    { queryKey: [...performanceQueryKeys.all(), "contribution", cycleId] },
  ];
  const submit = useApiMutation(
    (request: SubmitProgressRequest) => performance.submitProgress(cycleId, objectiveId, request),
    { invalidateQueries: invalidate }
  );
  const uploadEvidence = useApiMutation((file: File) => performance.uploadEvidence(cycleId, file));
  return { submit, uploadEvidence, evidenceDownloadPath: (id: string) => performance.evidenceDownloadPath(cycleId, id) };
}

/**
 * Opens a file-evidence item in a new tab. The download endpoint is bearer-authenticated, so a plain
 * link cannot carry the token; this fetches the file as a Blob through the authenticated client and hands
 * the tab a same-origin object URL. The blank tab is opened synchronously inside the click gesture so the
 * popup blocker permits it, then pointed at the blob once it resolves. `openingId` marks the row in flight.
 */
export function useEvidenceOpener(cycleId: string | null) {
  const { performance } = useApis();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = useCallback(
    async (evidenceId: string) => {
      if (!cycleId || typeof window === "undefined") return;
      const tab = window.open("about:blank", "_blank");
      setOpeningId(evidenceId);
      try {
        const blob = await performance.downloadEvidence(cycleId, evidenceId);
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.open(url, "_blank");
        // Revoke once the tab has had time to load the resource.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) {
        tab?.close();
        throw error;
      } finally {
        setOpeningId(null);
      }
    },
    [cycleId, performance]
  );

  return { open, openingId };
}

/**
 * Progressive loading for an objective's progress history. Seeded with the first page the progress surface
 * already carries, it appends older keyset-paginated pages on demand. Resets whenever the objective changes
 * or a new update lands at the top (a submit), so the accumulated tail never drifts from the refreshed head.
 */
export function useProgressHistoryPager(
  cycleId: string,
  objectiveId: string,
  firstPage: ProgressUpdateDto[],
  firstCursor: string | null
) {
  const { performance } = useApis();
  const [extra, setExtra] = useState<ProgressUpdateDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(firstCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const topId = firstPage[0]?.id ?? null;
  useEffect(() => {
    setExtra([]);
    setCursor(firstCursor);
  }, [objectiveId, topId, firstCursor]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await performance.getObjectiveProgressHistory(cycleId, objectiveId, cursor);
      setExtra((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [performance, cycleId, objectiveId, cursor, loadingMore]);

  return {
    items: extra.length > 0 ? [...firstPage, ...extra] : firstPage,
    hasMore: cursor != null,
    loadingMore,
    loadMore,
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCycle() {
  const { performance } = useApis();
  return useApiMutation((request: CreateCycleRequest) => performance.createCycle(request), {
    invalidateQueries: [
      { queryKey: performanceQueryKeys.cycles() },
      { queryKey: performanceQueryKeys.currentCycle() },
    ],
  });
}

export function useUpdateCycle(cycleId: string) {
  const { performance } = useApis();
  return useApiMutation((request: UpdateCycleRequest) => performance.updateCycle(cycleId, request), {
    invalidateQueries: [
      { queryKey: performanceQueryKeys.cycles() },
      { queryKey: performanceQueryKeys.currentCycle() },
      { queryKey: performanceQueryKeys.cycle(cycleId) },
    ],
  });
}

export function useActivateCycle(cycleId: string) {
  const { performance } = useApis();
  return useApiMutation(() => performance.activateCycle(cycleId), {
    invalidateQueries: [
      { queryKey: performanceQueryKeys.cycles() },
      { queryKey: performanceQueryKeys.currentCycle() },
      { queryKey: performanceQueryKeys.cycle(cycleId) },
    ],
  });
}

export function useUpdateSettings() {
  const { performance } = useApis();
  return useApiMutation((request: CycleSettingsDto) => performance.updateSettings(request), {
    invalidateQueries: [{ queryKey: performanceQueryKeys.settings() }],
  });
}

export function useSaveStrategy(cycleId: string) {
  const { performance } = useApis();
  const invalidate = [
    { queryKey: performanceQueryKeys.strategy(cycleId) },
    { queryKey: performanceQueryKeys.cycle(cycleId) },
    { queryKey: performanceQueryKeys.currentCycle() },
  ];
  const create = useApiMutation(
    (request: CreateStrategicObjectiveRequest) => performance.createStrategy(cycleId, request),
    { invalidateQueries: invalidate }
  );
  const update = useApiMutation(
    (args: { objectiveId: string; request: UpdateStrategicObjectiveRequest }) =>
      performance.updateStrategy(cycleId, args.objectiveId, args.request),
    { invalidateQueries: invalidate }
  );
  const publish = useApiMutation(
    (objectiveId: string) => performance.publishStrategy(cycleId, objectiveId),
    { invalidateQueries: invalidate }
  );
  const remove = useApiMutation(
    (objectiveId: string) => performance.deleteStrategy(cycleId, objectiveId),
    { invalidateQueries: invalidate }
  );
  return { create, update, publish, remove };
}

export function usePopulationMutations(cycleId: string) {
  const { performance } = useApis();
  const queryClient = useApiQueryClient();

  // Scope edits (org selections, include-sub-units) fire often during setup. The PUT
  // already returns the fully recomputed population, so write it straight into the
  // cache instead of invalidating and paying a second GET. Overview counts refresh in
  // the background (fire-and-forget) so the interaction never waits on them.
  const set = useApiMutation(
    (request: SetPopulationRequest) => performance.setPopulation(cycleId, request),
    {
      onSuccess: (data: PopulationDto) => {
        queryClient.setQueryData(performanceQueryKeys.population(cycleId), data);
        void queryClient.invalidateQueries({ queryKey: performanceQueryKeys.currentCycle() });
      },
    }
  );

  const confirm = useApiMutation(() => performance.confirmPopulation(cycleId), {
    invalidateQueries: [
      { queryKey: performanceQueryKeys.population(cycleId) },
      { queryKey: performanceQueryKeys.cycle(cycleId) },
      { queryKey: performanceQueryKeys.currentCycle() },
    ],
  });
  return { set, confirm };
}
