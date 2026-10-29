---
name: prefers-minimal-overhead-fix
description: "User strongly prefers the simplest, lowest-overhead fix; pushes back on elaborate plans"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3e144fd9-dd70-4ee8-abd3-f4cf99fa8684
  modified: 2026-08-07T17:27:06.077Z
---

When fixing a bug, the user wants the **simplest, least-overhead** solution that resolves the
root cause — not a broader hardening effort. On the dev-server "Internal Server Error" issue they
rejected a readiness-gated launcher script (new file + presets) and a docs update, and chose a
one-line `wait-on` gate on the shell `dev` script instead.

**Why:** they value minimal surface area and low maintenance for local-dev ergonomics over
comprehensive robustness.

**How to apply:** lead with the single smallest change that fixes the reported problem; offer
deeper hardening only as a clearly-optional footnote. Don't bundle doc updates or scope expansion
unless asked. Relates to [[ui-no-explanatory-text]] (same bias toward minimalism).
