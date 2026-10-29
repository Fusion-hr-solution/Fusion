---
name: cloud-sessions-partial
description: "Fusion work moves partly to Claude Code cloud sessions (B-158): cloud codes/tests/checks, local bursts for stack/journeys/screens via teleport"
metadata:
  node_type: memory
  type: project
  originSessionId: d4650456-462e-48c1-86c7-6700de7ee23e
  modified: 2026-10-29T14:35:14.708Z
---

Decided 2026-10-29 (B-158, plan `.local-docs/agents/plans/B-158-cloud-sessions.md`): partial move to Claude Code cloud sessions so the user's PC stays usable. Cloud VM: ~4 vCPU / 16 GB / 30 GB, Postgres 16 preinstalled, .NET not (setup script), nothing keeps running between sessions.

- Cloud does code, backend tests, frontend checks; pushes its own branch and opens a PR into `wassim/develop` (user merges). One cloud session at a time at first.
- Stack, API journeys and screens stay local in short bursts: `claude --teleport` picks up the session, runs them, pushes, stops the stack.
- Agent docs (`.local-docs/agents/`, with this memory and the canonical AGENTS.md) are tracked since B-159; the root AGENTS.md/CLAUDE.md are local pointers, so the cloud setup (B-160) must recreate them, the `.claude/skills/fusion-dev` link and the memory-folder link.
- Local-only work must keep working; cloud hooks guard on `CLAUDE_CODE_REMOTE`.

**Why:** the user wants the PC free without building a full cloud stack ("not at the cost of tooling the migration fully, if it's complicated").
**How to apply:** this narrows [[agent-commits-everything]] (cloud sessions now push branches and open PRs); keep [[machine-memory-checks]] for local bursts.
