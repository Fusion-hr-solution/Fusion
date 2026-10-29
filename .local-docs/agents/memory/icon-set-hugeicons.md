---
name: icon-set-hugeicons
description: "Performance app icons = Hugeicons (stroke-rounded) via src/lib/icons.tsx adapter, lint-guarded; DS primitives still Lucide; DESIGN.md §33.4 rewritten"
metadata:
  type: project
---

2026-09-30: user found Lucide glyphs generic/repetitive and overrode the old "Lucide stays" rule — consistency matters, but clean modern icons win over library loyalty. Chose **Hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`) and swapped **all Performance icons** in one pass.

Mechanism: `apps/performance/src/lib/icons.tsx` exports Hugeicons wrappers under the old Lucide names (Check, Target, Gauge…), strokeWidth default 1.75, `strokeWidth` accepts string so they satisfy DS `LucideIcon` props. All 50 files import from `@/lib/icons`; `apps/performance/.eslintrc.js` warns on direct `lucide-react` imports.

**Why:** one place to tune glyphs; drop-in swap without touching call sites.
**Platform too (2026-09-30):** `apps/platform/src/lib/icons.tsx` is the same adapter (62 icons; the glyphs it shares with Performance map to the same Hugeicons), plus the same eslint guard. `@repo/ds` now depends on Hugeicons too; the data-table filter button uses `FilterHorizontalIcon`, but the rest of the DS chrome is still Lucide.
**How to apply:** new icons in Performance or Platform go into that app's adapter; never import a set directly. Core and shell are still Lucide, and migrating them is a separate decision. DESIGN.md §33.4 now says: one set per surface through one adapter, never mix sets in a composition.
