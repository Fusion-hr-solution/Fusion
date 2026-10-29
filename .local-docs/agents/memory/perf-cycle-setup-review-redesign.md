---
name: perf-cycle-setup-review-redesign
description: Cycle setup Step 3 (Review & launch) overhaul — confirmation surface with summary cards + launch readiness rail + consequences
metadata: 
  node_type: memory
  type: project
  originSessionId: 52310d92-4b86-4201-ab23-e7d6d85a9a92
  modified: 2026-09-18T20:41:19.251Z
---

`/performance/cycle/setup/review` (Step 3) redesigned 2026-09-18 from a bare readiness checklist into a full confirmation-and-launch surface, per locked spec `.local-docs/tmp.md` + a supplied UI mockup (design *direction*, not theme — kept Fusion amber/DS tokens).

**Layout:** hero decision banner (ready = green "Ready to launch" + primary Launch cycle + "cannot be undone"; not-ready = warning variant listing `launchReadiness.blockers`, launch withheld) → two-column body: left = read-only summary cards (Cycle details / Population / Performance policy, each with Complete/Confirmed/Frozen-at-launch badge + Edit → its setup step); right rail = Launch readiness (4 derived checks + "Not required to launch": strategic direction / employee plans / communications) + "When you launch" consequences. Final gate still the existing `ActivationReview` confirm dialog (opened from hero). Applied Fusion restraint per [[ui-no-explanatory-text]]: sublines carry data (dates/counts), kept only genuine consequence copy at the irreversible transition.

**Files:** new `components/cycle-setup/review/` = `launch-hero.tsx`, `launch-rail.tsx` (LaunchReadinessPanel + LaunchConsequences), `review-summary.tsx` (CycleDetailsCard/PopulationCard/PolicyCard); rewrote `review-launch-step.tsx` (now fetches `usePopulation`+`useSettings`+`useOrgHierarchy` for org-unit names). Left `launch-readiness.tsx` untouched (still used by Overview `(pages)/page.tsx`).

**tmp.md business model was already implemented** in the backend (strategy NOT a launch blocker; reviewer readiness is a HARD blocker at population confirmation — so at review, reviewers are guaranteed resolved). Only backend change: added `OtherActiveCycleExists` (bool) to `CycleDetailDto` (+composer, +`@repo/api` `performance.ts`, +`setup-readiness.test.ts` fixture) so the "No other cycle is active" check is truthful, not string-inferred.

**Verification:** perf type-check/lint/32 FE tests green; backend build + 65 tests (1 env-skipped) green. Rendered light+dark+narrow via repo Playwright on **Solara Systems** (`qa-admin@fusion.test` / `Admin@123456`, draft cycle `91ad9d8a…` "FY2027 Performance Cycle", 35 confirmed ByScope participants). Narrow shell-frame/stepper clipping is pre-existing + shared across all setup steps (not the review body). Uncommitted; whole `cycle-setup/` folder is still git-untracked prior work. Builds on [[perf-cycle-setup-refactor]] + [[perf-cycle-setup-population-step]].
