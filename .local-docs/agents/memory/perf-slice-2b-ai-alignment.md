---
name: perf-slice-2b-ai-alignment
description: "B-070 slice 2b (AI coach, alignment map, shared AI transport) accepted, archived and committed; shapes slice 5 reuses and two hard-won gotchas (Groq schema compile, dagre labels)"
metadata:
  node_type: memory
  type: project
  originSessionId: 977b1ece-2887-4d79-8ce4-fa7cb6d1ef50
  modified: 2026-10-16T20:01:51.203Z
---

Slice 2b of [[perf-first-principles-rework]] applied 2026-10-16 as OpenSpec `add-ai-coach-and-alignment-map` (26/26), accepted 2026-10-16 and archived as `2026-10-16-add-ai-coach-and-alignment-map`, committed 2026-10-17 (`eb77ce5a`, `471d2ebb`, `d9b9be10`, `99200c62`) with follow-ups done: map cards use `ObjectiveStatusBadge` (no side stripe, see [[no-side-stripe-accents]]); `CoachField` puts title/parent suggestions inside the field frame; startup `ObjectiveCoachWarmUp` (first call 3.4 s, was 10 s); per-user rate limit 10/min (ASP.NET Core rate limiter, 429 hides the coach). Review file `.local-docs/agents/plans/B-070-slice-2b-ai-and-alignment.md`.

Shapes later slices reuse (slice 5 review drafts W4/W5):
- `SharedKernel/Ai/`: `GroqStructuredTransport` (strict json_schema, returns raw JSON; read with `AiStructuredResult.Read<T>`), `AiFailureCategory`, `GroqEndpoint`, `AiAvailability` gate (3 transient failures → 90 s cooldown; Unauthorized/no key → off until restart). Core HR's `GroqSemanticTransport` is now an adapter with the same signature and messages.
- Performance: `IPerformanceAiProvider` (10 s budget), `PerformanceAiAccess.IsAvailableAsync` (tenant switch `CycleSettings.AiAssistanceEnabled` + gate), capability `aiAssistance`, failure `Performance.AiUnavailable` (503, clients hide quietly), audit `Ai.Generated` (counts only). Test host swaps in `FakePerformanceAiProvider` (machine env has `GROQ_API_KEY`).
- Frontend: `components/coach/` (inline `CoachSuggestion`, `AiSuggestedTag`), `@repo/ds/flow` (layoutTree, AnchorViewport), map at `/goals?view=map&focus=&near=`.

Gotchas:
- **Groq compiles each distinct strict schema** before answering; a per-request schema (e.g. an enum of this request's keys) costs 7–10 s on first use and caused timeouts. Keep AI answer schemas constant (fixed key enum, validate server-side).
- **dagre writes x/y onto the node label object**: never pass one shared size object to `setNode` (all nodes stack). `layoutTree` copies now.
- React Flow `useNodesInitialized()` never reported ready for the map; use the `fitView` prop for entry and `viewportInitialized` for focus.

**Why:** next AI and chart work builds on these; the gotchas each cost a debugging round.
**How to apply:** reuse the transport/provider/gate/audit for W4/W5; keep schemas constant; read the review file before archiving.
