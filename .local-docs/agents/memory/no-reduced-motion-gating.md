---
name: no-reduced-motion-gating
description: "Don't gate animations behind motion-safe / prefers-reduced-motion unless asked"
metadata:
  node_type: memory
  type: feedback
  originSessionId: da139fcd-2bd4-4e8a-a709-2cc7fbe55885
  modified: 2026-10-01T13:38:35.228Z
---

Don't add `motion-safe:` / `prefers-reduced-motion` gating to animations, and don't bring it up in reports.

**Why:** User rejected it explicitly ("again with 'reduced motion' bullshit") when adding a pulsing attention beacon — it has come up repeatedly.

**How to apply:** Use plain `animate-*` classes; only add reduced-motion handling if the user asks for it.
