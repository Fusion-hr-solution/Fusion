---
name: fusion-dev-skill
description: Local environment work in Fusion goes through the fusion-dev skill (stack, backend tests, read-only SQL, API helper); replaces dev-stack.ps1
metadata:
  type: reference
---

The `fusion-dev` skill lives once in `C:\Code\EY\Fusion\.agents\skills\fusion-dev\` (Codex reads it there) with a directory junction at `.claude\skills\fusion-dev` (Claude). Scripts:
- `scripts/stack.ps1` (former `.local-docs/dev-stack.ps1`): `-Status`, up, `-Force -Only <Service>`, `-Down`.
- `scripts/test-backend.ps1 <Service>`: sets `FUSION_<SERVICE>_RELATIONAL_TEST_CONNECTION`, builds with `--artifacts-path` so the running service's lock never blocks (verified 2026-10-06: 314 passed with Performance up), prints Passed | Failed | Skipped.
- `scripts/sql.ps1 -Database <identity|corehr|performance> "<query>"`: read-only transaction.
- `scripts/api.cjs <email> <METHOD> <path>` or `require()`: login, call through :3000, Mailpit invite tokens; `.local-docs/agents/data/people.cjs` uses it.

**How to apply:** run these instead of hand-built commands. Related: [[engineering-first-agent-workflow]].
