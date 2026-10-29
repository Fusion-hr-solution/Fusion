---
name: perf-slice-5-calibration
description: "B-070 slice 5 (calibration, nine-box, insights, AI drafts) accepted, archived, committed 2026-10-20; Carthage rebuilt with a calibrated Year-end review; gotchas."
metadata:
  node_type: memory
  type: project
  originSessionId: 155b4ac0-fcab-4bf6-a40e-d997dbecfa1d
  modified: 2026-10-20T10:43:10.819Z
---

Slice 5 accepted, archived and committed 2026-10-20 (809a0d6b, bb24be9f, 6c1b43a8; not pushed). Live screens in `.local-docs/agents/plans/B-070-slice-5-screens/live/`. On Windows `openspec archive` can fail the final folder move with EBUSY and then roll back its spec writes: merge deltas by hand (ADDED appended, MODIFIED replaced by name) and validate --specs --strict.

Carthage was rebuilt that day (user's call): the Year-end review runs with calibration, limited to Amira/Mariam/Omar's teams (20 people); `seed-calibration.cjs` then `journey-calibration.cjs join|finalize` with `screens-calibration.cjs waiting|session|after` between them. A calibrated round can't be staged on a tenant whose active round runs without calibration (one active round per cycle), and every review must reach calibration before finalize, so subjects need accounts.

Gotchas:
- `@repo/ds` Sheet width needs `data-[side=right]:sm:max-w-[..]` (a plain `sm:max-w` loses); SheetContent must always render a SheetTitle, also while loading.
- `AnalyticsGuardTests` forbids average-like DTO fields; calibration insight DTOs are whitelisted per D-25.
- Performance route literals must come from `lib/performance-routes` (a guard test scans sources).

Related: [[perf-slice-2b-ai-alignment]], [[slice-close-settles-everything]].
