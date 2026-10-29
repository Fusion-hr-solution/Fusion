---
name: perf-target-state-change
description: "OpenSpec change establish-performance-target-state: Performance Phases 0–6, archived 2026-10-15 as the as-built baseline; superseded as authority by the B-065 rework"
metadata:
  type: project
---

`establish-performance-target-state` (Phases 0–6: hardening, Overview, Reviews, finalization, Calibration, contextual analytics, Request update) was implemented by Codex. It was archived on 2026-10-15 to `openspec/changes/archive/2026-10-15-establish-performance-target-state/`, and its deltas were synced into `openspec/specs/performance-*`. Code is in local commits `6fb41cc0`, `d3a8521e` and `9c2aad02`. CLI: `pnpm dlx @fission-ai/openspec@1.14.1` (not installed globally).

**Why it matters now:** the main specs describe the system **as built**. They are not authority for the areas being reworked. `refined-target-state.md` is no longer final authority; it's input only. See [[perf-first-principles-rework]].

**How to apply:** for Reviews, Calibration, Overview or Update Requests, follow the B-065 decisions document once it exists. Elsewhere, the archived specs remain the product contract.
