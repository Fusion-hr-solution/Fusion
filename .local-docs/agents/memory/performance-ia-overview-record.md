---
name: performance-ia-overview-record
description: "Performance IA (2026-10-02) — Overview-led nav, Org Goals demoted to contextual \"Organization direction\", one cycle-aware objective record, ObjectiveAccess policy"
metadata:
  node_type: memory
  type: project
  originSessionId: d83776d7-98c4-4295-9d18-66dfe8c9e563
  modified: 2026-10-02T21:42:30.677Z
---

Implemented 2026-10-02 on `wassim/develop` (commits c61403f9 → e1b774ae), from a ChatGPT deep-research report + user amendments.

- **Nav:** PRIMARY_NAV = Overview · My Plan · Team Performance (capability-gated); ADMIN_NAV Cycle/Settings. `/goals` kept, titled "Organization direction", back→Overview, reached from Overview / Team / record. `canViewOrgDirection` (performance-access.ts) = workspace entry only, NOT objective readability.
- **Objective record:** `components/objective-record/` — URL `?cycle=&objective=[&mode=record]`, host mounted once in `(pages)/layout.tsx`, thin sheet + `sections/*` + `modes/record-progress.tsx`; `useObjectiveRecord().open({cycleId, objectiveId})`. Replaced 4 drawers/panels.
- **Backend `ObjectiveAccess`** (Features/Goals/ObjectiveAccess.cs): one read/act policy for Company/OrgUnit/Employee; filters detail, overview, strategy list, traversal, progress; plan visibility = owner/admin/responsible manager once put forward. `GoalDetailDto` gained CycleId, Plan facet, CanDelete/CanUpdateProgress/CanReadProgressHistory.
- **Admin summary:** `GET cycles/{id}/plans/summary` counts only (no average progress); shared `PlansComposer.Classify`.
- **Overview:** `components/overview/overview-model.ts` compositional `resolveOverview` (no persona branching), sections end in workspaces.
- **Doctrine:** DESIGN.md §3.11 written (DESIGN.md is gitignored → local only).

**Known data issue (not code):** asteria-demo People Operations / Talent Pod org units are effective from 2026-08-29 but cycle af209517 starts 2026-08-01 → team-workspace 400 "team was not active at the start of this Cycle" for Hana/Nour.

Supersedes nav parts of [[perf-org-goals-scoped-planning]]. Follows [[architecture-durable-planning]].
