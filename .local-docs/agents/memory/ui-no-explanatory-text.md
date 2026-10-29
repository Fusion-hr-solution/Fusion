---
name: ui-no-explanatory-text
description: "User rejects verbose UI — no caption sentences or explainer text; state must be carried by bold, characterful structure (meters, affordances, numerals)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 54301384-e247-496d-b7d9-50698450050a
  modified: 2026-07-27T16:08:25.615Z
---

After the P1.3 surfaces shipped correct-but-verbose (2026-07-11), the user pushed back hard: "too much text laying around… the UI/UX should mostly speak for itself without having to explain it."

**Why:** Caption sentences under headings, explainer cards, hint lines, and labels that restate their own numbers read as generic AI output and bury the signal. The CLAUDE.md guidelines (bold/characterful first, no explanatory clutter) are meant literally — a screen passing tests and looking "clean" is still wrong if it narrates itself.

**How to apply:** Before shipping any Fusion screen, delete every sentence whose job is to explain the UI and replace it with structure: a glanceable instrument (e.g. the segmented amber `CascadeMeter`), an icon + short-phrase meta line, an empty state that IS the action (full-width dashed "Translate this pillar" button), big tabular numerals with two-word labels. Section captions, dialog descriptions, and policy-tone hints ("gaps never block…") go; tone is carried by neutral styling instead. Keep data (descriptions users authored, dates, names) — cut only chrome that talks.

Follow-up round (same day): the user also banned invented design metaphors in user-facing strings — "pillars", "translate/translated" — in favour of the product's established nouns ("Strategic objectives", "covered", "Add a team objective"). Check the campaign authoring terminology for the canonical noun before coining anything.

**Scope caveat (added 2026-07-27):** the concrete devices above — meters, big numerals, empty-state-as-affordance — are the P1.3 cascade surface's *solutions*, not a house style to reproduce. The user pushed back on seeing them quoted back as a design vocabulary: "not supposed to be taken to heart 1 to 1." Carry forward the rule (delete text that explains the UI; let structure carry state) and re-derive the device from the surface at hand. A meter is right when there is genuinely something continuous to measure, and wrong when it is decoration.

Related: performance-p1-3-cascade-team-objectives (archived), [[polish-includes-uiux-and-refactor]].
