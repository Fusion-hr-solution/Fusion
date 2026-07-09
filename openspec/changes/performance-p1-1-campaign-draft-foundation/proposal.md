## Why

P1.1 configuration (Platform Performance Configuration + Tenant Objective Planning Configuration) is complete and archived. The next lean P1.1 slice is the **Campaign Draft Foundation**: HR needs to create and maintain a professional performance-planning campaign *Draft* — identity, planning schedule, a frozen copy of the tenant's objective-planning rules, and campaign-level strategic objectives — so a Draft is ready for later P1.2 population and activation. The archived configuration change explicitly deferred campaign creation/dates to "a separate P1.1 change"; this is that change.

The repository already contains a Packet A `PerformanceCycle` aggregate (a campaign named "campaign," Draft-first, tenant-scoped) and a separate, generic period-versioned `StrategicObjective` module. The lean P1 umbrella spec is now the product authority. Rather than introduce a second, parallel campaign aggregate (duplicate/dead code), this change **refits the existing campaign aggregate** to the lean Draft model and introduces **campaign-scoped** strategic objectives — because the generic strategy module is the wrong model for the P1 cascade (campaign strategic objective → team objective → employee objective).

## What Changes

- Refit the existing campaign aggregate (`PerformanceCycle`) into the lean P1 **Campaign Draft** model. The Draft carries: campaign name; reference year; short purpose/planning guidance; owner (the creating HR user); and a planning schedule of four dates — planning opening, employee submission deadline, manager approval deadline, expected planning lock.
- Snapshot (copy) the tenant's **current** objective-planning configuration (max objective count, allowed weight menu, enabled measurement methods) into the campaign Draft **at creation**, frozen for the life of the Draft, and display it read-only.
- Introduce **campaign-scoped strategic objectives** as a child collection of the campaign Draft: title, description, optional responsible function label, and active/inactive within the Draft.
- Validate required fields, reference-year bounds, and strict date ordering (opening ≤ submission ≤ approval ≤ expected lock); validate that a Draft is *complete enough* to be handed to later population/activation, without performing any population/activation in this slice.
- Record audit/traceability facts for campaign Draft creation and meaningful changes (identity, schedule, snapshot, strategic-objective add/edit/activate) — actor, timestamp, and changed facts — reusing the existing Performance audit mechanism, without building a history product surface.
- Add a Performance frontend **Campaigns** area: route, list/empty state, a create flow, and a single Draft workspace (identity + schedule + read-only copied rules + strategic objectives) with sidebar and breadcrumb wiring. Cover loading, empty, error, validation, dirty-state, save-success, and stale-concurrency states with a polished, `@repo/ds`-aligned UI (no backend-shaped forms, no admin clutter).
- **BREAKING**: The campaign create/setup contract is realigned to the lean Draft shape. Packet A campaign create/update fields and the governance/population/feedback/exception configuration are **not** part of Draft creation or setup in this slice and are not surfaced in P1 UI (they remain wired to deferred P1.2+ features, so they are not dead code).
- **BREAKING**: In P1, campaign strategic objectives are **campaign-scoped**. The generic, period-versioned `StrategicObjective`/`StrategicPeriod` module is **superseded** as the P1 strategy model: it gains no new P1 UI, navigation, or extension. It remains wired only to its existing (unreworked, non-P1-UI) consumers; final removal and repointing of team/collective objectives is sequenced into the P1.3 change.

## Capabilities

### New Capabilities

- `performance-campaign-draft`: HR creates and maintains a Draft performance-planning campaign — identity (name, reference year, purpose, owner), planning schedule (four ordered dates), a frozen snapshot of tenant objective-planning rules, Draft-completeness validation, tenant isolation, authorization, and audit/traceability. Draft is the only lifecycle state in this slice.
- `performance-campaign-strategic-objectives`: HR manages campaign-scoped strategic objectives inside a Draft — title, description, optional responsible function, active/inactive — as the first (campaign) layer of the P1 strategic cascade.

### Modified Capabilities

- `performance-navigation`: Add the Campaigns area to the Performance sidebar and breadcrumb model (list, create, and Draft workspace routes) alongside the existing configuration navigation.

## Impact

- **Backend Performance**: refit the campaign aggregate (lean Draft fields, schedule, config snapshot value object, campaign-scoped strategic-objective child), create/update/query features and DTOs for the lean Draft, a copy of tenant objective-planning config at creation, EF configuration, and a migration. Realign or remove the campaign create/update surface that conflicts with the lean shape. Reuse `PerformanceAccessPolicyService`, tenant interceptor/isolation, optimistic concurrency (`Version`/xmin), and the audit writer.
- **Authorization / Identity**: reuse existing tenant-scoped campaign-manage permissions (`CycleManage`/`CycleView`) for Draft create/edit/view; confirm deny-by-default and platform-admin behavior. No new permission catalog entries expected; confirm during design.
- **Frontend Performance**: new Campaigns routes/pages/components under `apps/performance`, sidebar-nav entry, breadcrumb entries, query/mutation hooks via `@repo/api`, and `@repo/ds` components. Rendered UI verification required.
- **Persistence**: additive migration for the lean Draft/schedule/snapshot fields and the campaign-scoped strategic-objective table. Existing campaign data and Packet A tables preserved; no blind drops. Any table drop/repoint (generic strategic module) is explicitly deferred to P1.3 with a rollback path.
- **Superseded (documented disposition, not dead code)**: generic `StrategicObjective`/`StrategicPeriod` strategy module and its controller/features gain no P1 exposure; sequenced for removal/repointing in P1.3.
- **Out of scope**: population selection, participant preview, readiness checks, activation, workforce snapshot at activation, team/employee objectives, submission, approval, reminders, exceptions, planning lock, template library/categories/applicability/lifecycle, and any generic enterprise strategy module or per-campaign planning-rule overrides.
