---
name: project-overview
description: "Fusion HRIS — EY Tunisia internship project; module ownership, repo shape, ports, frontend boundaries, launch commands"
metadata: 
  node_type: memory
  type: project
  originSessionId: b9cf5393-d7d1-49c2-ac0a-c861edd30a2e
---

Fusion is a multi-tenant **HRIS platform**, an EY Tunisia internship/PFE project split across interns by module. Canonical version of this lives in repo `CLAUDE.md` (# Project Context); this is the plugin-proof backstop because the context-mode plugin owns/overwrites `CLAUDE.md` — see claude-md-plugin-owned (archived).

**User owns: Core HR** (foundation: tenant/company structure, workforce, employee records, org relationships) **and Performance Management** (workflow on top of Core). Core is the **source of truth**; Performance depends on Core and must not duplicate/own Core concepts. See performance-packet-a (archived).

**Colleagues' modules — do NOT interfere:** Youssef = Training + Onboarding; Raed = Interview + Recruitment. Their work is their own internships.

**Repo shape:** Backend .NET 10; Frontend Next.js 15 microfrontends (pnpm/Turborepo).
- Frontend apps: shell `:3000`, core `:3002`, performance `:3004`.
- Shared frontend packages: **`@repo/ds`** = shared **design system** for core+performance (used for shared design instead of `@repo/ui`; the `feature/ds-shared-design-system` branch is this work), plus `@repo/ui`, `@repo/auth`, `@repo/api`.
- Backend services/ports: Gateway 5000, Identity 5101, Training 5201, CoreHR 5301, Performance 5401; SharedKernel is a shared lib.

**Frontend boundaries:** keep domain UI in its owning microfrontend; no app-to-app deps between `Frontend/apps/*`; promote reusable visuals→`@repo/ui`/`@repo/ds`, auth/session→`@repo/auth`, API/query/transport→`@repo/api`. Cross-module UI should feel like one product but ownership stays explicit. Prefer clean self-explanatory UI; avoid clutter/helper text unless it aids usability.

**Process:** agent rules in `AGENTS.md`, UI/UX in `DESIGN.md`, live state in `.local-docs/agents/` (STATE/BACKLOG/LOG). Git conventions: `.local-docs/agents/git-conventions/`.

**Launch (PowerShell, day-to-day):** Frontend `Set-Location Frontend; pnpm dev` (or `pnpm --filter <core|performance> dev`, `pnpm lint`, `pnpm type-check`, `pnpm --filter <pkg> test`). Backend `dotnet run --project Backend/EY.HRPlatform.<Gateway|Identity|CoreHR|Performance>`. Docker only when a task needs containerized integration.
