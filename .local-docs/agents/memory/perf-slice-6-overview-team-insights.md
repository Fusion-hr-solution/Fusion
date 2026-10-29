---
name: perf-slice-6-overview-team-insights
description: "B-070 slice 6 + B-077 (Overview year/rows, My Team per phase, Cycle Insights, Fusion home) accepted, archived and committed 2026-10-22; phase rule and gotchas"
metadata:
  node_type: memory
  type: project
  originSessionId: a0c470e0-7a61-4d62-a4d4-1ff3a046f1b1
  modified: 2026-10-22T12:40:52.553Z
---

Slice 6 (`add-overview-my-team-insights-and-home`) accepted by the user 2026-10-22 and archived as `2026-10-22-add-overview-my-team-insights-and-home`; B-078 sidebar archived 2026-10-21. Both committed 2026-10-22 (11 commits, not pushed).

- **One phase rule:** `CycleDetailComposer.PhaseAsync` — an Active review round means Review whatever the date; used by cycle detail, workspace context and person summary. Carthage launched its round before planning closed, which exposed the earlier split.
- My Team groups come from the server (`group` + `groups`); the DataTable kit gained `rowGroup` for header bands.
- Live screens: Carthage is in Review, so only review-phase boards and homes are capturable; other phases wait for the demo seeder (slice 7). Scripts: `data/journey-overview-team-insights.cjs`, `data/screens-overview-team-insights.cjs`.
- Gotcha: archive merges can produce a requirement >500 chars that fails `openspec validate --specs --strict`; tighten it after archiving.

Next per board: B-095 demo presets seeder (slice 7), then B-089 cross-slice polish. See [[perf-first-principles-rework]], [[slice-close-settles-everything]].
