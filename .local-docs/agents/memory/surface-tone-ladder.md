---
name: surface-tone-ladder
description: "Fusion container backgrounds = one lift ladder (canvas → bg-section → bg-card → bg-inlay, overlays bg-popover); child never darker than parent; translucent neutral fills banned at rest; lint-guarded; uncommitted"
metadata:
  node_type: memory
  type: project
  originSessionId: 2768f89c-1f70-4e6d-936e-a7e26a2223b4
  modified: 2026-09-29T18:44:21.034Z
---

2026-09-29: user found `/performance/team` backgrounds "all over the place" (peer sections mixed `bg-muted/20` and `bg-card`, objective row sank to `bg-background` inside a card, seven ad-hoc `bg-muted/NN` opacities). User chose the **lift** model with fixed opaque tones and a **full sweep** of owned apps.

Tokens (`packages/ds/src/styles/tokens.css`, dark): canvas .141 / `--section` .175 / card .21 / `--inlay` .235 / popover .245. Utilities `bg-section`, `bg-inlay`.
Rules (DESIGN.md §8 "Tone ladder"): child always a higher tier (skip OK, reverse never); no 4th tone (dividers inside inlay); peers share a tone; overlays = top tier, nested groups in dialogs/sheets unfilled, their sticky footers `bg-popover`; dashed empty placeholders unfilled; semantic tints sit on top of the right tier; controls keep DS variants.

**Why:** translucent tints composite differently per parent and nesting went both directions, so nothing read consistently.
**How to apply:** use only `bg-section`/`bg-card`/`bg-inlay`/`bg-popover` for containers in owned apps; translucent neutrals only behind `hover:`/`data-*:` or on tiny marks. `packages/eslint-config/design-roles.js` (replaces `radius.js`; ESLint can't stack two `no-restricted-syntax` configs) warns on raw radii AND translucent neutral fills; the one allowed exception is the data-table refetch scrim (inline disable). ~150 sites swept; rendered lift-check script (`tone-qa.mjs` in session scratchpad) found no sinks on 8 pages. Related: [[radius-role-system]].
