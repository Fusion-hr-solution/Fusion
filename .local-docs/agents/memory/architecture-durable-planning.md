---
name: architecture-durable-planning
description: "How the user wants architecture plans shaped — durable against the next feature, coherent domain policies, capability composition, no dubious aggregates"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d83776d7-98c4-4295-9d18-66dfe8c9e563
  modified: 2026-10-02T20:33:24.265Z
---

When planning structural/IA work, design for the NEXT feature (e.g. Reviews), not just today's demo. From the user's review of the 2026-10-02 Performance IA plan:

- **Identity must be historically addressable**: reference domain objects with their owning context (e.g. `{cycleId, objectiveId}`), never resolve against "the current cycle".
- **Authorization = one coherent server-side domain policy** reused by detail, lists, traversal, progress, capabilities. When a change makes a surface canonical/deep-linkable, close ALL sibling leaks — don't "report only" known visibility holes.
- **PERMISSION ≠ PERSONA must be proven in code**: compositional resolvers (sections gated independently by capability), never `if admin / else if manager / else employee`.
- **Shared detail surfaces = thin shell + independent sections** with explicit data dependencies, so later features reuse sections without importing a god component.
- **No semantically dangerous aggregates** (e.g. average progress reads as an org performance score); prefer actionable operational counts.
- Write cross-feature contracts (e.g. Reviews↔Goals evidence/snapshot rule) into doctrine BEFORE the dependent schema is designed.
- Sparse navigation is fine; never add nav items to fill a sidebar.

**Why:** avoid rebuilding architecture when Reviews/results/history arrive.
**How to apply:** check plans against these before ExitPlanMode. Related: [[performance-ia-overview-record]], [[permission-gate-hide-not-deny]].
