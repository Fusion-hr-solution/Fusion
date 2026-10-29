---
name: perf-slice-2a-plan-pages
description: "B-070 slice 2a (objective status, change requests, update requests, development, plan side panel) — archived + committed 2026-10-16; key model choices to build on"
metadata:
  node_type: memory
  type: project
  originSessionId: 40e18638-6081-47c4-aca7-861c73a068d8
  modified: 2026-10-16T13:25:11.618Z
---

Slice 2a of [[perf-first-principles-rework]] shipped 2026-10-16: OpenSpec `2026-10-16-extend-plan-and-objective-pages`, commits `7bf08d66` (backend), `01345600` (shared packages), `29972d21` (Performance app). User accepted from screenshots alone (`.local-docs/agents/plans/B-070-slice-2a-screens/`).

Model choices later slices build on:
- One `ProgressUpdate` = one check-in: required `Status` (OnTrack/AtRisk/OffTrack), milestone changes as a child list, `StatusOnly` kind; the note is the reason when risky. `Objective.CurrentStatus/StatusSince/StatusAcknowledged*` denormalized; `LastCheckInAt` for recency.
- Reviewer attention: `objective-status` work item until acknowledged (`POST .../objectives/{o}/status/acknowledge`) or back on track.
- Change requests ride the Returned `PlanDecision` (`PlanChangeRequest`); resubmit gated by open requests; owner address endpoint needs the own-participation grant.
- `DevelopmentPlan` aggregate per participant+cycle at `/api/performance/cycles/{c}/people/{e}/development`; carries its own `competencyOptions` (settings catalogue is admin-only).
- Plan side panel = `PlanRail` (Status → Plan progress → Reviewer → Direction) for owner and reviewer lenses.

Demo data: Aicha Bouazizi (approved, at risk) and Sofiene Jebali (returned) activated via invite, reviewer Mariam Gharbi. Open follow-up B-080 (1280px card row overlap).

**Why:** next slices (1:1 suggestions, review evidence, Overview/My Team) read status, requests and development from these shapes.
**How to apply:** reuse these contracts rather than re-deriving; check the archived change's design.md D1–D11 for rationale.
