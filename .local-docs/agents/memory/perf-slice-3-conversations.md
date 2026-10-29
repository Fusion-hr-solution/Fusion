---
name: perf-slice-3-conversations
description: "B-070 slice 3 (1:1s, feedback, requests, praise) applied 2026-10-17 as add-one-on-ones-feedback-and-praise; in review; gotchas"
metadata:
  node_type: memory
  type: project
  originSessionId: 447c04f1-bbc9-429a-9b15-ec9bb94bae27
  modified: 2026-10-17T10:03:51.225Z
---

Slice 3 applied 2026-10-17 (OpenSpec `add-one-on-ones-feedback-and-praise`, 22/22, uncommitted, not archived), sent to In review with 16 screens in `.local-docs/agents/plans/B-070-slice-3-screens/`. Next on acceptance: `/opsx:archive`, commit when asked.

Shapes later slices reuse: `Domain/Conversations/` (OneOnOneSeries + OneOnOneMeeting, Feedback, FeedbackRequest, Praise), policies in `ConversationPolicies.cs`, `PerformanceViewer.CurrentLineAsync` (Core HR current line via new signed snapshots `direct-reports` and `search`), `GET /api/performance/values` and `people/directory`, `@repo/api` `performance-conversations.ts`, shared `usePraiseFeed`/`useReactToPraise`, `@repo/performance-ui` PraiseList/Summary* parts (hosts pass reaction icons).

**Gotchas:** an app that renders `@repo/performance-ui` must `@source` it in its globals.css (shell lacked it → unstyled cards; dev server needs a restart to pick up `@source`); Performance `formatDate` takes date-only strings (use `formatDay` for instants); a `Features.Feedback` namespace would shadow the `Feedback` type, so features live in `Features.Conversations`; EF maps getter-only collections as navigations (`OpenActionItems()` is a method for that reason).

**B-087 redesign (2026-10-17):** the user called the first screens bland; a canvas (`plans/B-087-screens/`) was approved ("a lot better", code it clean) and the surfaces rebuilt on new reads (1:1 rhythm/owed actions, `one-on-ones/start` + first agenda, `feedback/summary`, richer request rows, `praise/summary`), DS `--identity-1..5` value hues, `Textarea voice="narrative"`, performance-ui `PersonInitials`/`AvatarStack`/`ValueChip`. Change docs updated (tasks group 11).

Data: `seed-conversations.cjs` then `journey-conversations.cjs` (moves CDG-084 Salah to Omar). Related: [[perf-slice-2b-ai-alignment]], [[decide-surface-architecture-yourself]].

**Status 2026-10-19:** user accepted slice 3 + B-087 live screens ("lock em in for now"), unsure it is the final polish → B-088 (Needs discussion). Archived + committed 2026-10-19 (8d47108f..db65d50d).
