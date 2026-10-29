---
name: perf-design-reference-surfaces
description: "Design new Performance screens from the rendered, crafted ones (My Plan, objective drawer); the user rejects bland row-list 'data dump' mockups"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 25ffb106-285c-4419-9001-0a9732eb9464
  modified: 2026-10-15T10:38:58.999Z
---

When designing Performance screens, start from screenshots of the established, user-crafted surfaces. Never start from the doctrine alone. Approved surfaces get extended in place, never redrawn.

**Why:** 2026-10-15, B-069 batch 1. The first mockups redrew My Plan and the objective drawer, which the user said "we crafted that shit good". The other screens were "bland… too basic, data dump, barebones vibecoded feel": rows of title plus meta, with no visual anchors.

**How to apply:**
- **Capture the references first.** Take dark screenshots of the real app (`.local-docs/agents/plans/B-069-screens/reference/`, script pattern in that folder's history) before designing.
- **Reuse their language:**
  - an icon well tinted with the objective's accent (amber when aligned, blue when standalone);
  - small uppercase section labels;
  - numbered tiles (01, 02);
  - icon-led fact tiles;
  - dials and segmented bars;
  - milestone steppers with amber check circles;
  - large accent figures;
  - Lora for page titles and people's words.
- **Give each screen one dominant focus,** with visuals instead of labels: avatar strips, timelines, rings.
- **Add new features into existing surfaces in their style.** For example, objective status goes into the record-progress mode.

**Repeated 2026-10-17 (slice 3):** I built the 1:1s, Feedback, R8, composers and drawers straight from the spec as title + rows on an empty canvas with stock components, without a design pass. User: "bland boring and bad generally… too empty… generic components, no personality… no engineering went into architecting the parts… screens always feel nice at all states" (praise UI half excepted). Rule from now on: no new surface goes to code without a design pass first — a screens canvas per key state (empty, typical, busy, ended) in the reference language, each screen with one dominant focus and real composition, checked against the B-069 canvas fragments. A slice isn't ready for review until every state looks designed.

Related: [[perf-first-principles-rework]], [[layout-document-sidebar]], [[surface-tone-ladder]].
