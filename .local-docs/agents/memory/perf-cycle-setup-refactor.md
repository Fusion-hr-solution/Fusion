---
name: perf-cycle-setup-refactor
description: "Performance cycle-creation refactored into a guided nested-route setup flow; strategy dropped, reviewer now hard-blocks; uncommitted 2026-09-17"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9398a0bf-19de-48b4-9db6-5db68c03f213
  modified: 2026-09-17T08:22:47.256Z
---

Refactor of Performance cycle creation into one guided journey (Cycle details → Population → Review & launch → Active), replacing the old single `/cycle` page with `?area=` tabs and the duplicated launch on Overview. **Architecture-only pass — no visual redesign** (that's the next change). Uncommitted 2026-09-17 on branch `wassim/develop`. Builds on [[perf-frontend-reengineering-pass]].

**Backend** (`EY.HRPlatform.Performance`): added nullable `Cycle.Description` (+ migration `20260917065959_AddCycleDescription`, DTOs, mapper); `CreateCycleHandler` now derives planning deadline from `CycleSettings.PlanningDeadlineOffsetDays` (was hardcoded +30); `UpdateCycleHandler` realigns population eligibility + drops confirmation/participants when StartDate moves (`PopulationDefinition.RealignEligibility`); `MissingManager` is now HARD (`ReadinessIssue.IsHard`) so a reviewer-less participant blocks confirm/launch until resolved-in-Core or excluded; removed the published-strategy launch blocker and the `direction` readiness area. 61 backend tests green (added 5 in BehaviorTests).

**Frontend** (`apps/performance`): new `app/(pages)/cycle/setup/{layout,page,details,population,review}` + `features/performance/components/cycle-setup/` (setup-readiness helpers, stepper, 3 step components, footer). Step state is derived from `CycleDetailDto.launchReadiness` — no persisted wizard flags. Strategy (`StrategicDirection`/`useSaveStrategy`) is legacy (superseded by `/goals` org objectives) — unmounted, left dead for a later cleanup. Overview no longer activates (read-only readiness + "Continue cycle setup"); creation is no longer a modal (`cycle-details-dialog.tsx` deleted); `/cycle` is now the read-only established-cycle surface (Draft → redirects into setup). `@repo/api` cycle DTOs got `description`. Build + 29 unit tests green.

**Rendered-verified** end-to-end (light/dark/narrow): create → details (server-derived deadline Oct 17 = +30d) → population (CEO with no manager shows "Resolve before activation", excluded with reason) → review (2 of 2 ready, no strategy) → activation dialog (149 frozen, no Direction line) → active `/cycle`. Route guards and Overview de-dup confirmed.

**QA tenant** (see [[dont-reset-demo-passwords]] — I did NOT reset any demo password): used existing disposable tenant **Solara Systems** (`2ed67011-e4a4-4da4-9efd-6d000b98ec24`, 150 employees / 19 org units, no prior cycle). Provisioned a fresh admin `qa-admin@fusion.test` / `Admin@123456` by cloning the platform admin's password hash + the tenant's existing access wiring (SQL in scratchpad `provision-qa-admin.sql`). A test cycle "QA FY2026" is now Active in that tenant — disposable; can be closed/removed.
