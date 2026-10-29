---
name: state-for-every-task
description: Set STATE.md Active work at the start of ANY file-changing task (audits, checks, cleanups too) and update it as you go, not just LOG at the end
metadata:
  type: feedback
---

Every task that changes files gets the full `.local-docs/agents/` routine: set Active work in STATE.md before the first edit, update it after each step, then LOG + reset at the end.

**Why:** 2026-10-06 the user noticed a "final workflow pass" that edited AGENTS/DESIGN/tasks.md/memory was only logged at the end; STATE stayed None, so a cut-off mid-pass would have lost all context. Treating it as "just a check" was the mistake.

**How to apply:** if you're about to edit anything, STATE first, even for quick passes. Related: [[engineering-first-agent-workflow]].
