---
name: slice-close-settles-everything
description: "Before a B-070 slice closes, settle every open question and check each surface against the accepted B-069 screens canvas, listing built / later slice / dropped."
metadata:
  node_type: memory
  type: feedback
  originSessionId: a9d50d72-8527-435d-9c84-ac366a8b757d
  modified: 2026-10-15T20:54:59.211Z
---

The user wants every open question settled before a Performance-rebuild slice (B-070) is closed and the next starts, so they can "trust the process to completion". On slice 1 (2026-10-15) I built the Fusion home from the spec text and DESIGN.md only. It came out far thinner than the home the user had already accepted on the B-069 screens canvas (`.local-docs/agents/plans/B-069-screens/project/*.dc.html`), and the user called it "so empty its crazy".

**Why:** the canvas is the accepted design reference for B-070. Skipping it made the result untrustworthy even though every test passed.

**How to apply:**
- For each slice, read the matching canvas screens before building. Afterwards, write a parity list for each surface: built, deferred to slice N (with the reason), or dropped (the user agrees).
- Keep the OpenSpec artifacts in step with any deviation.
- Close only when the suites are green, or each failure is named on the board.

Related: [[perf-first-principles-rework]], [[perf-design-reference-surfaces]], [[finished-is-not-accepted]].
