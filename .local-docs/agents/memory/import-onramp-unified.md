---
name: import-onramp-unified
description: Organization + Workforce import ENTRY surfaces unified into one shared data-import on-ramp; sessions kept separate
metadata: 
  node_type: memory
  type: project
  originSessionId: 14c334ec-3871-4d74-91c6-c60a7354a804
  modified: 2026-08-26T08:51:59.882Z
---

The two import ENTRY surfaces — `/core/organization/import` and `/core/people/import` — were unified + UI/UX-overhauled into **one shared, authored on-ramp** (2026-08-26, uncommitted on `refactor/temp-branch`).

**Shared module**: `Frontend/apps/core/src/features/data-import/`
- `components/import-onramp.tsx` — the domain-agnostic `PageContainer` on-ramp: gate → PageHeader(title + quiet template/export utilities) → first-class as-of date → resume band (elevated) → journey rail (3 structural steps, `hidden sm:flex`) → single-footprint dropzone (idle/busy/rejected/temporary) OR inline Sheet/Header selector. Normalized presentational props.
- `components/import-date-control.tsx` — generalized as-of control (always-present native input, meaning tag, consequence/future-refusal line).
- `model/import-descriptor.ts` — `ImportOnrampConfig` + `workforceOnrampConfig` / `organizationOnrampConfig`.

**Adapters stay thin, keep their own intake orchestration + API hooks**: `organization-import-workspace.tsx` (`NewImportWorkspace`) and `workforce-import-entry.tsx` map their state machines → the shared surface. Fixed: people entry now has a real permission gate (`canImportCoreEmployees`) it previously lacked.

**Deliberately NOT touched** (the `[sessionId]` review workspaces, explicitly out of scope): `import-shell.tsx`, `workforce-import-session.tsx`, `import-review-*`, `import-inspector.tsx`. `workforce-baseline.tsx` (`BaselineControl`) is **kept** — the people SESSION shell still uses it. `workforce-source-intake.tsx` was deleted (ported into the shared module). So people entry (new on-ramp) and people session (old ImportShell + spine) intentionally differ in frame.

Verified: core type-check + lint clean; 41 import tests pass (36 org + 5 workforce); rendered both surfaces light/dark/narrow + error state through the shell (tenant10 admin `admin@tenant10.com` / `Admin@123456`). Related: [[workforce-import-establishment-proposed]], [[f4a-org-import-ai-ux]], [[ui-no-explanatory-text]].
