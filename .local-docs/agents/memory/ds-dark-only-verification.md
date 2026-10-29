---
name: ds-dark-only-verification
description: "Rendered QA and live screenshots: dark mode only, one standard laptop size (1440×900); no narrow, mobile or huge-screen passes"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b13a1cf8-a37c-45de-a128-dea605ab2413
  modified: 2026-10-21T09:35:52.164Z
---

The user stated (2026-09-25) that the Fusion design system is dark-only, so rendered verification targets dark mode only. On 2026-10-21 they added: "dont bother with too much resolution just pick one standard one for a normal demo on my laptop and thats it no need to perfect mobile and screens too small or too big".

**Why:** Light mode is unsupported, and the screens are judged as a laptop demo; extra widths cost time and memory for nothing.

**How to apply:** Live screenshots and rendered QA at 1440×900, dark, only. No 900-wide/rail/mobile/large-screen captures, even when a task list or spec mentions them; note the skip in the parity table instead. Related: [[rendered-verification-playwright]].
