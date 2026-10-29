---
name: next-dev-build-output-split
description: "Frontend dev servers write .next-dev, production builds write .next — fixes the recurring \"CSS is broken / no styling\" dev-server corruption."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b1c04f3-b030-4025-a237-de2949e37cf3
  modified: 2026-08-03T16:12:25.511Z
---

`pnpm build` is `turbo build` across **every** app. Before 2026-08-03, `next build`
and `next dev` both used `.next`, so any build run while a dev server was live
replaced that server's chunks with hashed production ones it never requests —
every stylesheet and script 404s and the app renders unstyled. Restarting dev was
the only cure, and it kept recurring.

Fixed by splitting the output directories in each owned app's `next.config.ts`:

```ts
distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
```

Applied to `shell`, `core`, `platform`, `performance`. `.next-dev` added to
`Frontend/.gitignore`. Production builds still emit `.next`, so deployment is
unchanged.

**Not applied** to `interview`, `learning`, `recruitment`, `onboarding` — those
are Youssef's and Raed's modules (see [[project-overview]]). They still have the
bug; the fix is the same one line if a shared contract ever justifies touching
them.

Separate, pre-existing, and still true: running `next build` while that app's dev
server is up fails at the type-check step with
`UNKNOWN: unknown error, open '<app>/next-env.d.ts'` — a Windows file lock on a
file both commands write, which `distDir` cannot separate. The failure is now
loud and harmless (dev survives) instead of silent and destructive. Stop the dev
server before building that app.

Diagnosis shortcut: `.next/BUILD_ID` exists ⇒ that directory holds a production
build. If a dev server is serving from it, that app is broken.
