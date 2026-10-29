---
name: polish-includes-uiux-and-refactor
description: "When user asks for wording/framing polish, they also expect audited UI/UX cleanup and code refactors — not wording alone"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 799ddc8e-8590-42ea-8f9c-f2d281ea83a3
---

When the user asks for a "framing polish" or "verify the UI" pass, they expect the plan to also cover **audited UI/UX cleanup and code refactors**, applied wherever an audit deems them needed for a smooth, clean flow — not just string/wording changes.

**Why:** They rejected a plan that was wording-only + verification. Verification without permission to *act* on findings is hollow; they want the audit to fix control correctness, interaction states, clutter, and structural code smells (e.g. a 1200-line monolithic component).

**How to apply:** Include an audit-then-fix loop against DESIGN.md (Do's and Don'ts + review checklist) and an audit-gated refactor section in polish/verification plans. Keep it finish-level (no scope/contract/backend expansion) per the Fusion Frontend Completion Gate. Relates to performance-packet-a (archived) and fusion-dual-workflow (archived).
