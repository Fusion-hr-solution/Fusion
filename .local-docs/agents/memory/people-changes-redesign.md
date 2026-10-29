---
name: people-changes-redesign
description: "B-139 people changes: built and accepted 2026-10-27 (change records, one panel replaces the Move confirm and change pages)"
metadata:
  node_type: memory
  type: project
  originSessionId: f7ecab3a-eef7-4145-8275-dae01b791131
  modified: 2026-10-27T21:43:55.564Z
---

B-139 redesigns how people change (under B-094's org chart). Canvas approved in full 2026-10-27 (all 12 calls); built and accepted by the user the same day.

As built: CoreHR `WorkforceChange` + `WorkforceChangeEffect` (rows created/ended, so cancel restores exactly) in `Features/People/Changes/`; endpoints `people/{key}/changes/job|end-employment|join`, `people/changes/{id}` (PUT edit), `/cancel`, `/upcoming`; a startup `WorkforceChangeBackfill` adopts scheduled rows made before records. Frontend `apps/core/src/features/people/changes/` (ChangePanel, change sheet with `?change=job|end|start`, ComingUpCard, DottedLines). Performance `people/{id}/line-effects` feeds the panel's "Also changes".

Gotchas found: read models must find a person's manager by `SubjectEmployeeId`, never by their current work assignment id (a job change creates a new assignment; lines keep the old one). Cancel must delete created rows (and save) before reopening ended ones: a partial unique index allows one open primary assignment.

**Why:** the user rejected the old task pages and the drag confirm on first principles ("nothing is kept for existing").
**How to apply:** extend the panel and records; don't revive `TaskShell`-style pages or the Move confirm. Follow-ups B-142, B-143. Related: [[people-org-chart-proposal]], [[canvas-first-for-taste-rework]].
