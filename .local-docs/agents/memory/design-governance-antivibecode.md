---
name: design-governance-antivibecode
description: "Anti-vibecode design governance hardening — DESIGN.md §33/§34, AGENTS.md visual completion contract, DS motion+elevation tokens"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1df649a5-215d-41c5-845b-aa1f1e7fa66d
  modified: 2026-08-16T19:30:28.716Z
---

**Superseded 2026-10-06:** DESIGN.md was recompiled; the §33 tells and §34 test now live in DESIGN.md §9 (Do's and Don'ts + review checklist, used only when a visual review is requested). The AGENTS.md contract and CLAUDE.md bullets below no longer exist. History follows.

Governance/DS hardening pass (2026-08-16) so future frontend work stops drifting to generic AI-admin/stock-shadcn UI. NOT an app-screen redesign — no product surfaces touched.

**DESIGN.md** — added §33 "Anti-vibecode visual discipline" (17 concrete tell→rule subsections: rounded-rect monoculture, white/gray soup, component fingerprint, icon discipline, one-accent syndrome, shadows/elevation, card-grid symmetry, pastel-pill syndrome, sparkle discipline, stock-Tailwind typography, structural whitespace, generated forms, ledger detail pages, human presence, dead-UI motion, skeleton discipline, AI-SaaS patterns) + §34 "The anti-vibecode test" (compact rendered-app gate). Existing §1–32 preserved; §33/§34 reference them, don't duplicate.

**AGENTS.md** — added §6 "Visual completion contract" subsection (8 binding rules incl. "'Existing UI looks acceptable' is not a valid reason to preserve it" and "Do not solve weak UI with explanatory text"). Compact, points to DESIGN §33/§34.

**CLAUDE.md** — 3 Claude-execution bullets: inspect whole journey (light/dark/narrow), don't self-certify polish from tests, report visual uncertainty.

**@repo/ds tokens.css** — additive only (no existing value changed → no visual regression): semantic elevation `--shadow-raised`/`--shadow-overlay` (light+dark, registered → `shadow-raised`/`shadow-overlay` utils); motion vocab `--duration-fast/normal/reveal/overlay` (plain props) + `--ease-standard/emphasized/exit` (registered → `ease-*` utils); global `prefers-reduced-motion` base rule. Components NOT retrofitted (future work adopts the vocab). Genuine gaps: DS previously had ad-hoc `shadow-xs/md/lg/xl` + `duration-100/200/300` with no semantic tokens.

Deliberately NOT changed: Inter, Lucide, radius scale, neutral palette (canvas already off-white 0.975 vs card white — distinction already exists), Sparkles AI use, any app screen. Not committed. See [[polish-includes-uiux-and-refactor]], [[ui-no-explanatory-text]].
