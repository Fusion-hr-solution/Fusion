---
name: canvas-first-for-taste-rework
description: When the user rejects screens on taste, design an HTML canvas per surface and state first, get approval, then code; it worked for B-087
metadata:
  type: feedback
---

When the user rejects UI on taste ("bland", "empty", "no personality"), build a local HTML canvas of every surface in its key states (empty, typical, busy, ended), render it to PNG and get approval before touching code. For B-087 (slice 3 conversations) the user answered "a lot better" and approved, adding only "make sure the code is clean, polish the minor stuff".

**Why:** taste can't be settled from code or tests; a reviewed canvas fixes the direction cheaply, and the user trusts the coding to close small gaps.

**How to apply:** canvas in `.local-docs/agents/plans/B-NNN-screens/` (shared canvas.css/frame.js, Playwright render), one dominant live object per screen, data that matches real domain rules; then build to it, checking it against DESIGN.md (the canvas itself can break rules, e.g. numbered markers, glows, arrows on links). Related: [[perf-design-reference-surfaces]], [[ui-no-explanatory-text]].
