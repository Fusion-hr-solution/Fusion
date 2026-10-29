---
name: radius-role-system
description: "Fusion corners = squircle role system (surface 28 / menu / control 18 / inset / nested / control-sm / detail / full) fitted to ChatGPT desktop, circular fallback, lint-guarded; uncommitted"
metadata:
  node_type: memory
  type: project
  originSessionId: 2768f89c-1f70-4e6d-936e-a7e26a2223b4
  modified: 2026-09-29T19:08:21.691Z
---

2026-09-29: Fusion radii migrated in one pass to a ChatGPT-measured ladder (user supplied ChatGPT screenshots; pixel-measured).
Roles in `packages/ds/src/styles/tokens.css`: `control` 10px, `surface` 16px (size-independent — menus/dialogs/cards alike), `inset` = surface − 6px (menu items in `p-1.5`), `nested` 6px (inside control-sized groups: tab triggers, input-group buttons, segmented thumbs), `detail` 4px, plus `full` for semantic pills. `affordance`/`object`/`feature` roles DELETED.
Numeric `rounded-sm…4xl` scale left untouched on purpose so Recruitment/Interview/Learning/Onboarding (other contributors) don't shift.

**Why:** user wanted consistent radii app-wide; previous app code used raw `rounded-2xl` (=32px on Fusion's remapped scale) etc.
**How to apply:** in shell/core/platform/performance/ds/auth use only `rounded-{control,surface,inset,nested,detail,full,none}`. `packages/eslint-config/design-roles.js` (was radius.js; extended by the 4 owned apps) warns on raw steps/arbitrary values. DESIGN.md §10 + §33.1 updated. Menu radius moved 20→16 (supersedes the earlier 20px menu approval).
Rendered-verified dark desktop+narrow (Nour, asteria-demo; platform admin); measured Fusion containers≈ChatGPT containers, controls≈controls. Codemod + QA script kept in session scratchpad only.

**Squircle corners (same day, user: "yes that's it"):** the ChatGPT "feel" was corner SHAPE, not size — continuous-curvature squircle vs our circular arc. `tokens.css`: role radii resolve via runtime `--corner-*` vars; `@supports (corner-shape: squircle)` bumps control 14 / surface 22 / inset 18 / nested 8 and applies `corner-shape: squircle` to role-class elements + sonner toasts; circular 10/16/12/6 fallback elsewhere. Menu padding p-1 (inset = surface − 4px).

**Calibration (fitted to ChatGPT settings screenshot, 2026-09-29):** squircle tier surface 28 / control 18 (clamps to half height = intended look; control-sm = control) / NEW `menu` role = control + 4 (menus sized from items, not cards) / inset = menu − 4 / nested = control − 3. Fallback (no corner-shape): 16 / 10 / 6 / 14 / 10 / 7. Card profile matched pixel-for-pixel. User confirmed their Chrome supports squircle; accepted the result ("might be overthinking"). **Rounder bump (2026-09-29, user: "happier with more roundedness overall"):** squircle surface 36 / control 22; fallback surface 20 / control 12; detail 4→6; menu/inset/nested still derive. Accepted + committed (113b8617); DESIGN.md §10 table updated + rule: third-party chrome (chart tooltips, React Flow) uses var(--radius-<role>) + squircle. DESIGN.md §10 rewritten around squircles (table of roles × tiers) + §33.1 synced — user wants DESIGN.md changed only when a base is settled.
