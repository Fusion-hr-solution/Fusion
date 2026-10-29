---
name: org-chart-interaction-polish
description: "Canonical Organization Chart polish — post-action reveal highlight, expand/collapse anchor stability, dark-mode controls"
metadata: 
  node_type: memory
  type: project
  originSessionId: df0a9bbf-3ee1-4054-a974-34fae10d7e96
  modified: 2026-08-15T22:42:15.895Z
---

Canonical Organization Chart is `Frontend/apps/core/src/features/organization/components/organization-chart.tsx` (React Flow / `@xyflow/react` + dagre layout), driven by `organization-workspace.tsx`. Three interaction fixes landed 2026-08-15 (uncommitted):

**1. Post-action reveal highlight.** After a structural action the affected units get a restrained Fusion-amber halo that fades. Mechanism: import commit already navigates to `/organization?asOf=…&reveal=<orgUnitId,…>` (model node id === orgUnitId). Workspace captures `?reveal=` into **component state** on first sight (NOT derived from URL — the param and derived values proved fragile across post-nav re-renders), expands ancestors via `dispatchLocal({type:'reveal'})`, holds `revealedIds` for a 2600ms timer, then clears. Manual Add-unit shares it via `revealUnits([id], id)` which sets `?reveal=` too. Chart marks `data.revealed` per node → `.org-reveal-highlight` class (halo via box-shadow `!important`), fade owned by the node's `transition-[…box-shadow…] duration-500 motion-reduce:transition-none`. NOT a keyframe animation — a toggled *state* + transition, so it survives React Flow node remounts during the reveal viewport move (culling under `onlyRenderVisibleElements`). New `RevealViewport` child centers a single revealed node / fitViews a set (genuine reveal is allowed to move viewport). Highlight styles + control theming live in new `Frontend/apps/core/src/app/(pages)/organization/organization-chart.css`, imported in `layout.tsx` AFTER `@xyflow/react/dist/style.css`.

**2. Expand/collapse anchor stability.** Was: dagre re-lays-out all nodes on toggle → interacted node jumped across screen. Fix: `AnchorViewport` child + `handleToggle` capture the toggled node's pre-relayout position, and after relayout translate the viewport by the node's delta (zoom preserved) in a `useLayoutEffect` so it stays put. Verified: node screen x,y identical before/after collapse AND expand, leaf + root subtree. No global fitView on toggle.

**3. Dark-mode controls.** React Flow's `.react-flow__controls`/`-button` default CSS is hardcoded light. Overrode with DS semantic tokens (`--card`/`--border`/`--muted-foreground`/`--muted`/`--foreground`/`--ring`) for bg/border/icon(`fill:currentColor`)/hover/focus-visible/disabled — theme-aware in both modes (verified computed styles: dark card oklch 0.21, light white; not regressed).

Verified (Playwright, mechanism-level): reveal halo tracks React state (dom count === revealed-node count) ~2.6s then fades; anchor x,y stable; dark/light control tokens correct; 0 console errors. **Gotcha learned: don't reuse chart node ids across sessions/renders — grab fresh ids each run or the reveal silently no-ops.** Cross-clock DOM-vs-React timing comparisons are unreliable; sample both on one in-page clock. Type-check/lint/11 model tests/build all green. Visual polish left to user.