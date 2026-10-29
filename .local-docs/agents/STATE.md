# STATE — live handoff

Lets any agent resume mid-task. Update after each step. When done: log to `LOG.md`, close the item (○) or send it to In review per the review gate in `AGENTS.md`, reset these sections to None, and update `Last finished`. Accounts and seed scripts: `data/`.

**Last finished:** 2026-10-29: ○ B-160 cloud environment written (setup script, session bootstrap, bash backend tests; canonical AGENTS.md now tracked). Earlier today: ○ B-159, ○ B-157, B-158 cloud direction decided; ✓ B-155, ✓ B-154, ✓ B-153, ↻ B-002, ✓ B-152, ○ B-151, ○ B-150, ✓ B-127. The B-104 hand pass still waits on the user.

## Active work

**B-161** Cloud pilot (child of B-158). First cloud session done 2026-10-29 (results on the board and in the B-158 plan › First cloud session). Blocked on the user: GitHub push access for the Claude app on the `Fusion-hr-solution` org, and re-pasting the updated `cloud/setup.sh`.

## Goal

One backend-only item end to end in a cloud session (tests, commit, push, PR into `wassim/develop`), then `claude --teleport` for the local check.

## Plan & progress

1. [x] Environment checks in the cloud (bootstrap, relational tests, hook): pass.
2. [x] Fixed: setup warms caches from a `master` clone; `~/.claude/CLAUDE.md` switches onto `wassim/develop` (local commit pending).
3. [ ] User: install the Claude GitHub App on the org (or reconnect GitHub), re-paste setup.sh, start sessions with the repo selected.
4. [ ] Cloud session: one backend item end to end with push + PR. None small and backend-only is Ready; pick or split one with the user.
5. [ ] Teleport locally, check, merge.

## Decisions & reasoning

- The pilot's findings commit (34a1c2c) stayed in its container; recorded locally instead of recovering it.

## Where it stands

Waiting on GitHub access.

## Open questions & blockers

- Push 403: Claude GitHub App not installed on `Fusion-hr-solution` (https://github.com/apps/claude/installations/select_target, org admin), or reconnect at https://claude.ai/connect-github.
