---
name: perf-reviewer-plan-surface
description: "Reviewer view of a submitted employee Plan — canonical route, reuse of My Plan grammar, plan-level decision; plus two render-loop fixes it surfaced."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e1010b2-7f04-4b26-8ac5-21be2f8843e2
  modified: 2026-09-05T14:58:04.674Z
---

Reviewer Plan Surface (built 2026-09-05, uncommitted). The assigned reviewer opens the **same** Plan resource the employee authors, curated for a plan-level decision. Extends [[perf-my-plan-populated-draft]].

- **Route:** `apps/performance/src/app/(pages)/team/[planId]/page.tsx` → `PlanReview` (`components/plan/plan-review.tsx`). Nested under `/team` (not `/plans`) so the breadcrumb parent is a real page: Performance / Team Performance / {employee name}. A notification deep-links straight here — not through the Team queue. `PlanReviewQueue` rows are now `Link`s to `/team/{planId}`; the old inline `ManagerDecisionWorkspace` was **deleted** (one reviewer surface, not two).
- **Backend already existed** — no backend change. `getPlanDetail(cycleId, planId)` (`GetPlanForReviewHandler`) authorizes assigned-reviewer/admin/owner; `canDecide` (responsible manager + reports capability) gates controls; `returnPlan`/`approvePlan` via `usePlanReviewMutations`. Frontend-only feature.
- **Composition** reuses My Plan grammar: `CycleContextBar`, `PlanDirection` (reviewer + FOCUS AREA/SUPPORTS), read-only `PlanObjectiveRow` (no menu), `AllocationGauge`. New bits: employee-identity heading (name + Submitted badge + "{cycle} Plan Review" + orgUnit · "Submitted for your review" — **no job title**, it's not in `EmployeePlanDto`), "Awaiting your review" context card (submitted/objectives/allocated, state-adaptive), person-led Plan snapshot (donut + aligned/standalone, dedup'd vs context bar), Review-decision card (Request changes inline textarea, required feedback; Approve via lightweight AlertDialog confirm).
- **Product decisions (user, 2026-09-05):** objective references on Request changes = **omitted** (plan-level, feedback only; no backend/domain change); per-row **"View details" affordance omitted** entirely (canonical objective-detail surface designed separately later — no dead control, no throwaway sheet).
- **Two pre-existing render loops fixed** (both "Maximum update depth exceeded", both surfaced by rendering this page): (1) `packages/ds/src/shell/charts.tsx` `AllocationGauge` used `ResponsiveContainer` on a **fixed** square → ResizeObserver feedback loop; replaced with fixed-size `<PieChart width={height} height={height}>` (also fixed My Plan). (2) `apps/performance/src/shell/breadcrumb-overrides.tsx` `useBreadcrumbLabel` effect depended on the whole memoized `ctx` (changes on every override write) → cleanup-clear/body-reset loop; now depends on the stable `setOverride`/`clearOverride` callbacks (also fixes `goals/[id]/edit`).
- **Verified:** perf type-check + lint + 21 tests green; ds type-check + lint green; rendered as **Hana Dridi** (`hana.dridi@asteria-demo.com`, pw the local password (`FUSION_LOCAL_PASSWORD`) — asteria-demo tenant `00e0aa50…`) reviewing Nour Fischer's Submitted plan (id `84b78b81…`), light+dark+narrow + both decision panels, **0 render loops**. Did NOT execute a real approve/return in-browser to preserve demo state (those mutations are the pre-existing ones Team Performance already used).
