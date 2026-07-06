## 1. Lean P1.1 OpenSpec Questions

- [x] 1.1 Confirm the P1.1 partition boundary in writing: "Configuration and Campaign Draft" is the broader partition label, while this OpenSpec change implements only `Platform Performance Configuration` and `Tenant Objective Planning Configuration`; if Campaign Draft is still required in P1.1, create a separate OpenSpec capability/change before coding it.
- [x] 1.2 Decide whether Campaign Draft is explicitly deferred, split into a later P1.1 change, or renamed out of this partition; document the decision so developers do not add campaign creation, dates, population, activation, employee objectives, manager approval, or draft campaign tables while implementing configuration.
- [x] 1.3 Define the exact Platform Performance Configuration data contract: maximum supported objective count, platform-supported whole-percent allowed weights, Quantitative availability, Qualitative availability, and the starting tenant configuration copied during provisioning.
- [x] 1.4 Define platform "allowed weights" as a curated whole-percentage choice set that tenant admins subset; reject free-text bounded values, arbitrary decimals, every-possible-value defaults, and messy arbitrary values such as 17%, 23%, or 37%.
- [x] 1.5 Define whether the platform maximum objective count is a single upper bound only or whether any lower/default count exists; if a default exists, decide whether it belongs to the starting configuration rather than the supported limits.
- [x] 1.6 Define whether Quantitative and Qualitative measurement availability are independently toggleable and whether the platform may disable both; if both cannot be disabled, make that validation explicit.
- [x] 1.7 Define the starting configuration defaults for new tenants: initial max objective count, initial allowed weights, initial enabled measurement methods, required actor/source facts, and what happens when no starting configuration exists.
- [x] 1.8 Define the exact Tenant Objective Planning Configuration data contract: tenant max objective count, tenant allowed weights, enabled Quantitative/Qualitative methods, concurrency token, applied actor, applied timestamp, and no other dimensions.
- [x] 1.9 Define whether tenant allowed weights must be a subset of platform-supported weights, equal to a platform-supported list, or validated by another rule; reject any implementation that lets tenant values drift outside platform limits.
- [x] 1.10 Define the 100 percent feasibility rule precisely: no duplicate menu values, whole percentages only, 5% increments as the P1.1 standard, whether future objective plans may reuse a selected weight value across objectives, and the algorithmic proof required within maximum objective count.
- [x] 1.11 Define UI controls for each bounded value: count slider/stepper, weight chips or multi-select, and two measurement toggles; reject raw text inputs for bounded values unless no bounded source exists.
- [x] 1.12 Define user-facing terminology for both screens and fields: avoid "policy", "guardrails", "baseline", "draft", "publish", "superseded", "enum", "measurementTypes", and backend field names in product UI.
- [x] 1.13 Define View states for both capabilities: configured, not configured, validation blocked, permission denied, stale/conflict, retryable error, and read-only/no-manage permission.
- [x] 1.14 Define Edit behavior for both capabilities: which fields can change, whether edits are local until Apply, how unsaved changes are represented, and how failed validation preserves entered values.
- [x] 1.15 Define validation behavior for both capabilities: validation and impact checks run as part of Apply, return blocking reasons without persisting, and preserve entered values.
- [x] 1.16 Define Apply behavior for both capabilities: exact transaction boundary, expected concurrency token, audit facts, response shape, and immediate UI state after success without manual refresh.
- [x] 1.17 Define platform impact semantics: when platform limits change, exactly how existing tenant configurations are checked, what counts as blocking impact, and how to prove existing tenants are never silently updated.
- [x] 1.18 Define provisioning ownership: which Identity service triggers Performance provisioning, whether provisioning is synchronous or retryable after tenant creation, how failures are surfaced operationally, and what idempotency key or uniqueness constraint proves no duplicate tenant configuration.
- [x] 1.19 Define the no-mutation-on-GET proof: list every GET/read path for platform config, tenant config, summary, navigation, bootstrap, and frontend data fetching; require tests that no platform/tenant/audit/provisioning rows are created.
- [x] 1.20 Define authorization ownership and semantics: exact Identity permission keys, access-profile defaults, Platform Admin platform-only rights, tenant admin manage rights, tenant context requirements, and whether Platform Admin can manage tenant config only with explicit tenant-scoped permission.
- [x] 1.21 Define tenant isolation proof: tenant query filters, controller/service tenant checks, cross-tenant negative tests, platform-scope exceptions, and what data can be returned when tenant context is missing.
- [x] 1.22 Define audit/support facts: which actor id/name, timestamp, previous/applied values or diff, reason/change summary, correlation id, tenant/platform scope, source starting configuration, and concurrency facts must be preserved without building a history product.
- [x] 1.23 Define API compatibility and breaking changes: which current endpoints/DTO fields are removed, renamed, or retained temporarily; how clients discover the new shape; and which old tests must be deleted because they assert rejected behavior.
- [x] 1.24 Define migration inventory before schema changes: counts and sample rows for platform defaults, tenant policies, policy versions, template categories, template revisions, starter templates, applicability data, audit entries, and permissions.
- [x] 1.25 Define migration handling for out-of-scope persisted data: preserve dormant, archive to retired tables, export, or drop only if proven empty; do not let "outside scope" become accidental data loss.
- [x] 1.26 Define dead-code boundaries: what template/category/applicability/starter-template backend code, frontend routes, auth helpers, labels, tests, and migrations are removed now versus intentionally left dormant for a future capability.
- [x] 1.27 Define test evidence required before marking implementation tasks complete: backend unit/integration tests, authorization tests, migration tests, frontend tests, lint/type-check, and rendered UI verification for both platform and tenant admin journeys.
- [x] 1.28 Re-check `proposal.md`, `design.md`, and both specs after answering 1.1-1.27; update the artifacts if any answer changes scope, permissions, persistence, migration, API behavior, UI behavior, or verification expectations.
- [x] 1.29 Define the recommended platform starter weight menu as `5, 10, 15, 20, 25, 30, 40, 50`, and document why the MVP avoids arbitrary values, over-50 default weights, and every possible 5% value from 5 to 100.

## 2. Professional Target First MVP Curation

- [x] 2.1 Write the professional target model before touching code: how a serious multi-tenant HRIS should separate platform-supported configuration, tenant-owned planning configuration, provisioning, permissions, audit facts, and campaign draft.
- [x] 2.2 Curate the MVP explicitly from that target: list what remains in this change, what is deferred to a separate Campaign Draft change, and what is removed because it belongs to templates, objectives, campaign execution, or later performance workflows.
- [x] 2.3 Challenge every existing implementation artifact against the target instead of preserving it by default: platform defaults, tenant objective policy, policy versions, template compatibility, history UI, permissions, seeders, migrations, and frontend navigation.
- [x] 2.4 Separate required constraints from accidental legacy constraints: live persisted data, published API consumers, Identity provisioning, and tenant records are required constraints; old names, old DTO fields, old pages, Draft/Publish wording, and template scaffolding are accidental unless proven otherwise.
- [x] 2.5 Produce a final MVP acceptance checklist before implementation: if a behavior does not directly support Platform Performance Configuration or Tenant Objective Planning Configuration, it must be removed, deferred, or justified as migration safety.

## 3. UI/UX Grill and Recommended Interaction Pattern

- [x] 3.1 Inspect existing Fusion UI patterns first: `Frontend/packages/ds`, `Frontend/packages/ui`, `Frontend/apps/performance`, current settings/admin pages, and relevant shadcn components before designing custom controls.
- [x] 3.2 Recommend the interaction pattern on user meaning, not implementation convenience: platform configuration should be a compact settings workspace with current values, edit controls, validation impact, and apply; tenant configuration should be a current-configuration editor with local edits, validation, and apply.
- [x] 3.3 Reject weak controls: no free-text inputs for bounded weights or measurement methods, no enum labels, no backend field names, no raw JSON strings, no lifecycle badges that imply Draft/Publish/Superseded, and no template/category affordances.
- [x] 3.4 Define the exact controls: objective count as a bounded slider/stepper, allowed weight menu as chips or a multi-select from platform-supported choices, and Quantitative/Qualitative as explicit toggles or segmented choices with at least one selected.
- [x] 3.5 Define form grouping by intent: "Planning size", "Weight choices", "Measurement methods", and "Apply review" only if those groups reduce user decision load; avoid sections that mirror DTO structure.
- [x] 3.6 Define truthful screen states: configured, not configured, read-only, permission denied, validation blocked, stale conflict, retryable failure, and applied success; never show default values as if they are applied tenant truth.
- [x] 3.7 Define validation UX: quiet by default, run impact checks on Apply, show blocking reasons without cross-tenant leakage, preserve entered values on failure, and do not show false success.
- [x] 3.8 Define navigation and terminology: use product language such as "Platform performance configuration" and "Objective planning configuration"; remove "Objective templates" and avoid "policy", "guardrails", "baseline", "draft", "publish", and "superseded" in user-facing UI.
- [x] 3.9 Define layout quality expectations from Fusion design rules: use `@repo/ds` components, token colors, compact controls, no nested cards, no decorative explanations, no gratuitous motion, no generic card grids, no arbitrary borders, and WCAG AA contrast.
- [x] 3.10 Define mobile and responsive behavior: controls must remain usable on narrow widths, validation/apply actions must stay discoverable, and dense admin information must collapse structurally rather than relying on tiny text.
- [x] 3.11 Define rendered verification before completion: inspect the actual UI in browser for platform admin, tenant admin, unauthorized user, validation blocked, stale conflict, not-configured, loading/skeleton, and retryable error states.
- [x] 3.12 Record the final UI recommendation before implementation and compare alternatives: if a modal, table, card grid, free-text field, or custom control is chosen, document why the standard inline settings workspace and bounded controls are insufficient.
- [x] 3.13 Ensure user-facing copy describes weights as business importance choices for future objective plans, not mathematical configuration, score formula internals, or P1.1 employee assignments.

## 4. Backend Configuration Model

- [x] 4.1 Replace platform defaults/guardrails/baseline contracts with Platform Performance Configuration contracts covering only max objective count, curated whole-percent allowed weights, Quantitative availability, Qualitative availability, and starting tenant configuration.
- [x] 4.2 Replace tenant objective policy contracts with Tenant Objective Planning Configuration contracts covering only max objective count, allowed weight menu, and enabled measurement methods.
- [x] 4.3 Refine domain entities and validators so no manager SLA, cascade/strategic alignment, attachments, objective-library enablement, template compatibility, Draft, Publish, or Superseded behavior is exposed in configuration APIs.
- [x] 4.4 Preserve optimistic concurrency, atomic Apply, no-mutation GET behavior, and essential actor/timestamp/change facts in backend handlers.

## 5. Provisioning, Authorization, and Persistence

- [x] 5.1 Keep Identity-to-Performance tenant provisioning explicit and idempotent; verify retry returns the existing tenant configuration without duplicates.
- [x] 5.2 Enforce Platform Admin-only access for platform configuration and tenant-scoped manage/view permission for tenant configuration, with server-side deny-by-default tests.
- [x] 5.3 Update Identity permission catalog, access-profile seed/backfill behavior, and frontend auth helpers so template/category permissions no longer define this P1.1 scope.
- [x] 5.4 Create a migration plan and EF migration that preserves existing configuration facts, inventories template/category data, and avoids blind data deletion.

## 6. Frontend Experience

- [x] 6.1 Replace Performance Platform Defaults UI with Platform Performance Configuration editable settings -> Apply changes using bounded controls for weights and measurement availability.
- [x] 6.2 Replace Tenant Objective Policy UI with Tenant Objective Planning Configuration editable settings -> Apply changes, including 100 percent weight feasibility feedback only when blocked and preservation of user input on failure.
- [x] 6.3 Remove or hide Objective Templates, Template Categories, policy history/version detail, and out-of-scope navigation from the P1.1 Performance UI.
- [x] 6.4 Verify rendered UI in the shell/performance microfrontend for platform admin, tenant admin, unauthorized, validation-blocked, conflict, not-configured, and success states.

## 7. Tests and Verification

- [x] 7.1 Add/replace backend unit and integration tests for platform configuration validation, impact blocking, concurrency, audit facts, no GET mutation, and no existing-tenant mutation after platform changes.
- [x] 7.2 Add/replace backend tests for tenant configuration validation, whole-percent/5% standard enforcement, 100 percent weight feasibility, platform-limit enforcement, tenant isolation, authorization, atomic Apply, and idempotent provisioning.
- [x] 7.3 Add/replace frontend tests for bounded controls, validation/apply workflows, permission-gated navigation, recoverable errors, conflict handling, and removal of template/category/history flows.
- [x] 7.4 Run required verification: `dotnet test`, `Set-Location Frontend; pnpm --filter performance test`, `Set-Location Frontend; pnpm lint`, and `Set-Location Frontend; pnpm type-check`.
- [x] 7.5 Perform real UI verification after implementation with the app running, and record screenshots or notes for desktop and mobile-relevant states before marking tasks complete.

## 8. Dead-Code Cleanup and Migration Safety

- [x] 8.1 Remove backend template/category/applicability/starter-template code from the active P1.1 surface only after confirming persistence handling and tests.
- [x] 8.2 Remove frontend template/category/history components, routes, labels, and tests that only support the excluded P1.1 scope.
- [x] 8.3 Remove or deprecate out-of-scope API endpoints and DTO fields with explicit breaking-change notes for any consumers.
- [x] 8.4 Verify database migration rollback or preservation strategy before any destructive table/column changes.

## 9. Validation Streamlining and Integration Polish (post-implementation)

- [x] 9.1 Unify the Apply outcome contract so platform and tenant both return a structured `{ applied, configuration, errors }` result; a blocked apply is `applied = false` (HTTP 200, nothing persisted), stale stays 409, not-provisioned stays 404.
- [x] 9.2 Make client-side validation reuse the exact backend message strings (`configuration-logic.ts` mirrors `PerformanceConfigurationValidator`) so a rule reads identically whether caught on the client or server.
- [x] 9.3 Surface a blocked apply the same way on both screens (one "Can't apply yet" reasons list); reserve "Apply failed" for transport/conflict; keep existing-tenant impact as its own advisory.
- [x] 9.4 Remove the unused `validate` endpoints, commands, and DTOs (backend + `@repo/api`), and convert their coverage into apply-path tests.
- [x] 9.5 De-duplicate the two configuration pages onto shared bounded controls and shared weight/validation logic.
- [x] 9.6 Move the platform configuration UI to `/configuration/performance` (no `platform` segment in the URL), parallel to `/configuration/planning`; update nav, breadcrumb, and tests.
- [x] 9.7 Confirm the 99% starting default (count 5, weights `5,10,15,20,25,30,40,50`, both methods) is consistent across seeder, provisioning, and the frontend not-configured placeholder.
- [x] 9.8 Re-run verification: frontend type-check, `pnpm --filter performance test` (35 passed), lint clean; backend `dotnet test` after stopping the locally running Performance service.
