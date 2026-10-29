---
name: finished-is-not-accepted
description: "Review gate — only noticeable, taste-dependent work goes to In review; evidence-settled work closes ○; acceptance is read from conversation, not checkboxes"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d3f02051-948b-4b22-b1b2-b89d6b4a5938
  modified: 2026-10-08T18:48:08.793Z
---

When an agent finishes an item: close it (○ in LOG, off the board) when evidence settles it, such as backend-only work of any size, refactors, config, small fixes, or anything done exactly as asked. Send it to **In review** only when it is noticeable and judgment-dependent (UI/UX, flows, wording, product calls, human-facing docs, deviations from the request), with a "Look at:" line saying what to look at and where. Read the user's verdict from the conversation: approval or moving on closes it ✓; a complaint becomes a Ready child under the parent. There is no Done lane; LOG is the one history.

**Why:** 2026-10-07, empty boards hid review work. Then on 2026-10-08 the user found every trivial or backend item parked in review: "I'm not gonna comb through code", and "manually ticking boxes defeats the whole purpose."

**How to apply:** on "what's next", answer from STATE + board + recent LOG. Never park backend code in review. Related: [[agent-run-board]], [[engineering-first-agent-workflow]], [[state-for-every-task]].
