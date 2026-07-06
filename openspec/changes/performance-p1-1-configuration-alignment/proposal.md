## Why

Performance P1.1 has been re-locked to a lean configuration scope. The repository currently contains broader P1.1 implementation and specs for policy, templates, categories, applicability, history, and platform defaults; this change realigns OpenSpec to the actual product scope before implementation continues.

**P1.1 scope note:** This change delivers only the *configuration* slice of Performance P1.1 — Platform Performance Configuration and Tenant Objective Planning Configuration. It is deliberately not the whole of P1.1: campaign draft, templates, categories, applicability, and later objective-plan/workflow behavior are out of scope here and, where still required, belong to separate P1.1 changes. The archived history of this change should read as "the P1.1 configuration foundation," not "all of P1.1."

## What Changes

- Introduce Platform Performance Configuration as the platform-owned source for system-supported limits and the starting objective-planning configuration used only when new tenants are explicitly provisioned.
- Define platform objective-weight support as clean whole-percentage choices, with 5% increments as the P1.1 professional standard and `5, 10, 15, 20, 25, 30, 40, 50` as the recommended starter menu.
- Introduce Tenant Objective Planning Configuration as the tenant-owned configuration for objective count, the allowed weight menu for future objective plans, and enabled measurement methods.
- Require both workflows to show current values in an editable settings surface where `Apply changes` runs server-side validation/impact checks and either applies atomically or rejects without losing entered values.
- Require explicit, idempotent new-tenant provisioning from the current platform starting configuration.
- Preserve essential actor, timestamp, and change facts without exposing a dedicated history product.
- **BREAKING**: remove the old P1.1 "policy and templates" product framing from the active change. Objective templates, template categories, template applicability/revisions, starter templates, template-related platform limits, and template compatibility checks are outside this change.
- **BREAKING**: remove exposed Draft/Publish/Superseded lifecycle language and flows from platform and tenant configuration. Internal version rows may remain only as persistence/audit mechanics, not as user-facing workflow.
- **BREAKING**: remove tenant objective-policy dimensions outside the locked scope, including manager-review SLA, cascade/strategic alignment, attachments, objective library enablement, and template-related limits.
- **BREAKING**: remove arbitrary decimal weighting precision and any interpretation that lets tenants type uncurated values such as 17%, 23%, or 37% into the objective-weight menu.
- **BREAKING**: remove campaign creation, campaign dates, population/activation, employee objective plans, manager approval, and manager-review SLA configuration from this P1.1 scope.

### Implementation alignment (as built)

- Standardize the Apply contract across both surfaces: Apply returns a structured result and reports a blocked attempt as `applied = false` with human-readable reasons (HTTP 200, no exception). Transport failures and stale-concurrency conflicts stay distinct (409). Client and server share one canonical validation message set so a rule reads identically wherever it is caught.
- Surface a blocked apply the same way on both screens — a single "Can't apply yet" reasons list. "Apply failed" is reserved for transport/unexpected errors; existing-tenant impact is shown as its own advisory. This replaces the earlier split where tenant validation landed under "Apply failed" as one joined string.
- Remove the unused server-side `validate` endpoints for both surfaces (a third, drifting validation copy with no caller). Validation runs as part of Apply, plus instant client-side gating.
- Serve the platform configuration UI at `/configuration/performance`, parallel to the tenant `/configuration/planning`, with no `platform` segment in the user-facing URL. Backend API routes are unchanged.
- Consolidate the two configuration pages onto shared bounded controls and shared weight/validation logic to remove duplicated, drift-prone code.

## Capabilities

### New Capabilities

- `performance-platform-configuration`: Platform Admin manages supported objective-planning limits and the starting objective-planning configuration for newly created tenants.
- `performance-objective-planning-configuration`: Tenant Admin manages the tenant objective-planning configuration within platform limits.

### Modified Capabilities

- None. Existing `performance-platform-defaults`, `performance-objective-policy`, `performance-objective-templates`, `performance-tenant-provisioning`, and `performance-configuration-audit` specs are superseded by the two lean capabilities for this new change and must not drive implementation unless their behavior is explicitly restated here.

## Impact

- Backend Performance: configuration entities, DTOs, validators, controllers, provisioning handler, audit writer, EF mappings, migrations, and tests must be aligned to the lean dimensions.
- Backend Identity: tenant creation must keep explicit Performance provisioning, and permission catalog/access-profile grants must reflect platform configuration and tenant configuration ownership without retaining template/category permissions for this scope.
- Frontend Performance: admin navigation and pages must expose only Platform Performance Configuration and Tenant Objective Planning Configuration for P1.1; template/category/history surfaces must be removed or hidden from this scope.
- Persistence: migrations must preserve existing configuration facts and avoid blind deletion of template/category data. Dropping or archiving out-of-scope tables requires an explicit migration decision and rollback path.
- APIs: endpoints and response contracts for draft/publish/history/template/category flows become incompatible with this lean scope and must be removed, replaced, or kept internal only where justified by migration safety.
