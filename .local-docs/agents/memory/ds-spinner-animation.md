---
name: ds-spinner-animation
description: "DS Spinner rotation — use Tailwind built-in animate-spin, not a custom @utility keyframe (prod tree-shakes it)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 14c334ec-3871-4d74-91c6-c60a7354a804
  modified: 2026-08-28T11:40:51.146Z
---

`@repo/ds` `Spinner` (`packages/ds/src/components/ui/spinner.tsx`) is the reused loading spinner across Core (~20 usages) — a lucide `Loader2Icon`.

It was static in some contexts because it used a **custom `animate-fusion-spin`** — defined as a hand-written `@utility animate-fusion-spin { animation: fusion-spin 0.8s … }` + a bare top-level `@keyframes fusion-spin` in `packages/ds/src/styles/tokens.css`. That combo works in dev (measured: rotating) but is fragile in **production builds**: Tailwind v4 only preserves `@keyframes` registered through the theme's `--animate-*` mechanism, so a prod build keeps the `.animate-fusion-spin` rule but **tree-shakes the keyframes** → the animation references nothing → static icon. (`@theme inline` here doesn't emit custom props, so registering there wouldn't fix it either.)

**Fix (2026-08-28, uncommitted):** switched Spinner to Tailwind's built-in **`animate-spin`** (first-class animation, keyframes emitted in every build) and deleted the now-unused `fusion-spin` `@utility`+`@keyframes` from tokens.css. Verified in-browser: exact lucide markup + `animate-spin motion-reduce:animate-none` → animName "spin", playState running, transform changes over time (rotating). No `fusion-spin` refs remain anywhere in Frontend.

**Why:** custom CSS animations must be registered so Tailwind preserves their keyframes in prod; prefer Tailwind built-ins (animate-spin/pulse/etc.) for anything reused, over hand-rolled `@utility`+`@keyframes`. **How to apply:** if a reused animation is static only in built/deployed contexts, suspect keyframe tree-shaking; use the built-in or register via `@theme --animate-*` (not `@theme inline`, not a bare `@utility`). Relates to [[next-dev-build-output-split]].
</content>
