---
name: next-bundled-react-no-useeffectevent
description: "Next 15.5 app router runs its own bundled React, which lacks useEffectEvent; type-check and lint pass, the page crashes at runtime"
metadata:
  node_type: memory
  type: project
  originSessionId: 9d97cbad-4c2b-4248-b79c-1ef0292b1c10
  modified: 2026-10-28T17:22:01.073Z
---

`useEffectEvent` type-checks (the apps' `@types/react` / React 19.2.4 have it) but Next 15.5's app router uses its own compiled React (`next/dist/compiled/react`), which doesn't export it: the page throws `useEffectEvent is not a function` and renders nothing. Found on the org chart (B-132, 2026-10-28).

**Why:** tsc and eslint-plugin-react-hooks 5.2 both accept it, so only a rendered page shows the failure.

**How to apply:** don't use `useEffectEvent` in our Next apps until Next is upgraded; keep the latest callback in a ref updated by an effect instead. Prove new React APIs on a rendered page, not with type-check alone. See [[rendered-verification-playwright]].
