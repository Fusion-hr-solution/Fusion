---
name: no-side-stripe-accents
description: "User reads a coloured left-border stripe on cards (status edge) as vibecoded; carry status/emphasis another way"
metadata:
  type: feedback
---

On the slice 2b alignment-map screenshots (2026-10-16) the user called the node cards' coloured left border (`border-l-[3px]` tinted by status) "way too vibecody", and made removing it the priority follow-up (B-083), while praising the map overall as the wow factor.

**Why:** a thick coloured side stripe on a rounded card is a stock generated-UI tell; it undercuts otherwise good surfaces.

**How to apply:** don't use side-stripe accents (left/right coloured borders) on cards, rows or callouts for status, AI or emphasis; carry it with the existing status dot + word, tint, or structure. Check the coach suggestion rows for the same tell. Related: [[design-governance-antivibecode]], [[perf-slice-2b-ai-alignment]].
