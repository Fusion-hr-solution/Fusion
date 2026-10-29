---
name: agent-run-board
description: "Agents run .local-docs/agents (board, log, state) autonomously — user rarely opens or edits them; capture, brief, reshape hierarchy on the go; clean markdown"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d3f02051-948b-4b22-b1b2-b89d6b4a5938
  modified: 2026-10-08T18:48:13.093Z
---

The user wants the `.local-docs/agents/` system to run itself "like Jarvis for Tony Stark": they should rarely open these files and almost never edit them. Agents capture what the user asks for, reports, accepts or rejects as it happens. They brief the user (in flight, waiting on them, next) at session start or when asked, and they reshape the board hierarchy as the conversation moves: split, merge, reparent, retitle, with no rigidity and no churn. Markdown stays clean (symbols ✓ ○ → ↻ instead of words, day-grouped LOG, backticked times, the agent name kept as a trailing tag).

**Why:** stated 2026-10-08 during the workflow rework (B-042); the user wants the system to help them, not create chores.

**How to apply:** AGENTS.md must stay at about 70–75 lines (≤150 hard). Put formats in the file headers, not in AGENTS.md. Related: [[finished-is-not-accepted]].
