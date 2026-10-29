---
name: perf-first-principles-rework
description: "B-065: user moved Performance from Codex to Claude; rebuild the whole module from first principles into a complete, integrated, demo-ready, impressive HRIS module"
metadata:
  type: project
---

On 2026-10-15 the user chose to continue Performance with Claude instead of Codex. The plan is to rebuild the **whole module** from first principles. The result must be complete, fit seamlessly into Core HR and the shell, and be clean, coherent, demoable and impressive. Plan: `.local-docs/agents/plans/B-065-performance-first-principles-rework.md`. The heaviest rework is in Reviews, Calibration, Overview and Update Requests. Work that isn't on the board yet is expected.

**Why:** constant drift (authority scattered across research docs, with gaps filled from existing code); bare-bones UI that doesn't match the Performance surfaces built earlier; and contracts fixed before UX states, which forced frontend rework after backend verification.

**How to apply:**
- **Order:** inventory, then research, a feature catalogue and the interview, then a decisions document (decision IDs, the only authority), then surface architecture and a role × state design approved before contracts, then small OpenSpec changes end to end.
- **The agent owns** the product knowledge of what a mature performance module has, plus architecture, contracts, implementation and surface design. It mostly doesn't ask implementation questions.
- **The user agrees** core, add-ons, nice-to-haves and wow features from the agent's recommendations. These are drawn from mature products (Lattice, Culture Amp, 15Five, Betterworks, Workday, SAP SuccessFactors) and from brainstorming that fits Fusion; the AI-assisted Core HR import is the precedent for "wow".
- **Priority is shared surfaces:** which records and workspaces exist, what features compose into them, and how they hand off across roles and states. These are hard to rework late. **The agent decides surface architecture outright.** The user isn't familiar enough with these systems to answer it, so show them concrete role/state walkthroughs to react to instead of asking.
- **`/performance/settings` is low priority:** features add settings to it with plain UI, and it gets one redesign at the end (B-071).
- **Existing code** that contradicts a decision gets flagged, never silently kept.

Related: [[perf-target-state-change]], [[architecture-durable-planning]], [[engineering-first-agent-workflow]].

**Target and visual bar (2026-10-15):** the final graduation demo. There's no "after", so build everything complete and don't sequence MVP-first. For look and feel the user names BambooHR: friendly, good layouts, professional, but not newspaper-like (no walls of text or editorial density).

**Demo vs design (2026-10-15):** design and engineering stay independent of any one demo story. Every role and state must work, and any orderly journey must be supportable. The B-072 storyline is only a test case, and the seeder builds scenario presets relative to the run date, not one fixed world (D-41).
