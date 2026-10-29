---
name: rewrites-acceptable
description: "User is fine with full rewrites when warranted — don't over-constrain plans to refactor-in-place"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 21472bbd-7292-4791-9484-bdc69b683f34
---

When planning overhauls/redesigns, do not frame the work as "redesign, not a rewrite" or otherwise
bias toward refactoring existing components in place. The user explicitly said rewrites are fine
when warranted: "if things need a rewrite we have nothing against that."

**Why:** The user cares about the cleanest end result, not minimizing diff against existing code —
consistent with AGENTS.md's "code is evidence, not authority" ("Do not preserve bad architecture just because it already exists").

**How to apply:** Recommend the approach that produces the best result. Treat component-level
keep/refactor/replace verdicts as a starting bias, not a constraint. Still avoid replacing proven
*infrastructure* without reason, and don't over-engineer beyond MVP.
