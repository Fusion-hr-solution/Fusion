---
name: no-cosmetic-history-rewrites
description: "Don't propose rewriting commits (reword, rebase) for cosmetic issues like a missing blank line after the subject"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2b277ad6-6680-4f21-b9d9-25cbf5da65a8
  modified: 2026-10-25T20:34:49.959Z
---

The user declined rewording two unpushed commits whose messages lacked a blank line after the subject (2026-10-25): "I would rather not change things like this if its not important."

**Why:** history rewrites carry risk and churn; a cosmetic flaw in a commit message isn't worth it.

**How to apply:** leave committed history as it is unless something actually matters (wrong content, secrets, a broken build). Get message shape right before committing instead ([[commit-hook-and-message-shape]]); don't raise past cosmetic slips as open questions.
