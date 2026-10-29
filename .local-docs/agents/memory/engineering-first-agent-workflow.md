---
name: engineering-first-agent-workflow
description: "How the user wants agents (Claude + Codex) to work in Fusion since 2026-10-06 — engineering first, rendered QA on request, one STATE.md, untouched stock skills"
metadata:
  node_type: memory
  type: feedback
  originSessionId: af9c14c5-ea46-45e8-9891-65edb889fa9a
  modified: 2026-10-06T15:08:55.598Z
---

Since 2026-10-06 the user wants agent time spent on features and engineering, not process: functionality, correct domain/authz/tenant engineering, the necessary tests (task-named plus obvious negatives), some creative UI work. Bad UI gets polished later; bad engineering doesn't get rewritten.

- Rendered QA, Playwright, screenshots and DESIGN.md §34 review only when the user asks. UI polish goes to `.local-docs/agents/BACKLOG.md` (a polish pass comes later).
- Shared agent space `.local-docs/agents/`, OpenSpec-independent: `STATE.md` = current work only (Active work always; Flags, Git, Accounts in use, Blockers only when they apply; no progress that tasks.md already shows), `BACKLOG.md` = shared saved/deferred items by area, `LOG.md` = append-only condensed history with `YYYY-MM-DD HH:MM · agent ·` entries. Flags are only the non-intuitive ones and override skill or instruction guidance. Always-true rules belong in AGENTS.md, not STATE.
- Never modify original/stock skills or commands (e.g. OpenSpec's `/opsx:*`); override behavior through STATE.md flags instead; regenerating them with `openspec update` (stock, newer) is fine.
- Scopes should be intuitive: cross-project tools at user level (context7, context-mode, playwright-cli, frontend-design, codex plugin, security-review); Fusion-specific things at project level (OpenSpec, LSP plugins, Fusion MCP config).
- BACKLOG.md is a board since 2026-10-07: lanes In progress → In review → Ready → Needs discussion → Done. Finished work goes to In review with a review file (`plans/B-NNN-<slug>.md`); agents never delete items or mark them Done. Only the user accepts. STATE.md carries `Last finished`. See [[finished-is-not-accepted]].
- context-mode stays as the full plugin (user's call after research).
- CLAUDE.md was deleted; Claude reads AGENTS.md natively. AGENTS.md (66 lines, research-based) and DESIGN.md (280 lines, Google DESIGN.md order) were rewritten 2026-10-06; grow them from real friction, not in advance.

**Why:** the user measured ~45% of agent time going to overhead (QA loops, env management, process docs) and said "the most important thing is the code, features and functionality exist".

**How to apply:** start each session from STATE.md, log to LOG.md, defer to BACKLOG.md; skip browser verification unless asked; don't add skills, plugins or process docs without asking. Related: [[perf-target-state-change]], [[prefers-minimal-overhead-fix]].
