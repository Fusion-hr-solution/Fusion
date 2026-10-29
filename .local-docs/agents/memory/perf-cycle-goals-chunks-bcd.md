---
name: perf-cycle-goals-chunks-bcd
description: "Perf Cycle & Goals Chunks B/C/D (org goals, employee plans, progress+contribution) implemented + rendered-verified, uncommitted"
metadata: 
  node_type: memory
  type: project
  originSessionId: 398588b0-beed-457c-af2a-51cb7e6ffa3b
  modified: 2026-08-21T15:30:21.849Z
---

OpenSpec change `establish-performance-cycle-and-goals` — Chunks **B, C, D implemented + rendered-verified 2026-08-21** (uncommitted, branch `refactor/temp-branch`). Builds on [[perf-cycle-goals-chunk-a]]; see [[perf-cycle-goals-proposed]] for scope. Continued via `claude-resume-chunk-b-continue-c-d-apply.md` (auto-advance B→C→D, stop before archive/redesign).

**Chunk B — Direction & organizational goals:** organizational `Objective` (OrgUnit scope, one-parent alignment, Draft→Submitted→Approved), direct vs calculated progress source, `ContributionLink` (100% baseline), parent-accountable approval (NO tenant-admin override, design Decision 4). Signature **Alignment Map** (focus+context, breadcrumb, "Explore N aligned", contribution amber pill only under calculated parent), org composer (Sheet, "Supports {parent}"), decision-surface approval, Live Weight Summary.

**Chunk C — Employee plans:** `EmployeePlan` aggregate (Draft→Submitted→Approved&Locked), one-plan-per-participant (unique index), employee `Objective` rows (EmployeePlanId+PlanWeight, aligned/standalone), self-scoped authoring, responsible-manager review, governed exceptional approval. Signature **Plan Composer** (numbered ledger, not a table), **Live Weight Summary** (segmented meter, "Ready to submit"), **Manager Decision Workspace** (≠ editor read-only), locked tracking. Employee objectives excluded from the org Alignment Map.

**Chunk D — Progress & contribution:** append-only `ProgressUpdate` + owned `EvidenceItem` (File|Link|Reference), `IPerformanceEvidenceStore` (tenant-partitioned local FS), owner-only recording, required-context in-flow (decrease/reopen/correction), denormalized current state + `HasProgress` (missing≠0). Signature **Progress Update Composer** (measurement-aware; numeric baseline→target track + derived preview), **Evidence Uploader** (stage-before-save, authorized download only where named-detail auth holds), **Progress History** timeline, **Plan progress** (labeled, capped), **Contribution Explorer** (company→org drill, reported-progress primary, coverage quieter/null for direct, aggregate-safe). `ProgressCalc`: truthful roll-up over configured contributors only; aligned≠contributor.

**Gates:** backend 51 tests + 1 relational skipped; api/auth/performance typecheck+lint clean; performance prod build clean; 3 additive migrations applied to `hris_performance`. **Rendered-verified light+dark+narrow** through the shell with real auth.

**tenant10 demo state (cycle FY2026 `80724eb5-…`):** provisioned **dorra.sassi@tenant10.com** / `Admin@123456` (Employee profile, reports to Amina) via real invite→accept flow. Live journey done: Dorra authored 2-objective plan (aligned numeric 60% + standalone manual 40%) → submitted → **amina.mansour@tenant10.com** approved → Dorra recorded numeric progress (14h → 83.33%) + PDF evidence → Plan progress 70% → Amina's Contribution Explorer shows "Grow the customer base" 50% (Amina recorded strategic actual 1400/1600). Managers amina/youssef.benali have logins; org-objective owners (Sami/Omar) do not.

**Known debt (deferred, non-blocking):** live calculated-parent coverage demo needs a multi-owner org seed (org-objective owners lack logins) — covered by unit tests, not shown live. Product-wide A–D visual coherence pass is the deliberate NEXT step (not started). NOT committed; NOT OpenSpec-archived (stop condition honored).
