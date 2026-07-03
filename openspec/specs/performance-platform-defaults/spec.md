# performance-platform-defaults Specification

## Purpose

Defines the platform-owned Performance defaults surface: hard guardrails, the current standard setup
for new tenants, fail-closed impact handling, truthful load states, and Platform Admin-only access.

## Requirements

### Requirement: Platform guardrails define hard system limits

The system SHALL maintain platform Performance guardrails that define hard, system-supported bounds
(minimum/maximum objective count, minimum/maximum manager review SLA, permitted percentage
precision, maximum allowed weighting values, supported measurement types, maximum template title and
description lengths, maximum tags). Guardrails MUST NOT be tenant defaults; tenant policies and the
platform standard setup MAY only configure values within guardrails. Guardrail data is platform-owned,
carries no tenant identifier, and MUST be managed only by an actor holding `PlatformRole.PlatformAdmin`.
The locked P1.1 supported limits are: 1-10 objectives per plan, 1-30 manager review days, whole
percentage weights, 10 allowed weight choices, Quantitative and Qualitative measurement support, 150
title characters, 500 description characters, and 10 tags.

#### Scenario: Guardrails are read independently of tenant context

- **WHEN** a Platform Admin reads the active guardrails
- **THEN** the system returns the current guardrail values without requiring a tenant context

#### Scenario: Tenant endpoints cannot reach platform guardrails

- **WHEN** a tenant-scoped request attempts to read or modify platform guardrails
- **THEN** the request is rejected and no platform data is returned

### Requirement: Platform standard setup is internally versioned and immutable

The system SHALL maintain a platform standard setup for new tenants as an internally versioned record:
each successful Apply creates a new immutable current platform state and supersedes the prior one while
preserving it for traceability. This versioning is an internal guarantee rather than a surfaced Draft or
version-management workflow. The locked recommended values are: 7 objectives per plan, allowed weights
`5,10,15,20,25,30,40,50`, manager review SLA of 10 business days, strategic alignment Optional,
Quantitative and Qualitative measurement, and attachments enabled.

#### Scenario: Applying a valid standard setup creates a new immutable current state

- **WHEN** a Platform Admin applies a valid standard setup
- **THEN** a new current platform state is created
- **AND** the prior current platform state is preserved and superseded

#### Scenario: Prior applied states remain unchanged

- **WHEN** the standard setup changes
- **THEN** the prior applied state remains unchanged and is not edited in place

### Requirement: Guardrail changes run impact analysis and fail closed on conflict

Before applying a guardrail change, the system SHALL run impact analysis against active tenant
policies and the current platform standard setup. A guardrail change that would make an existing
active tenant policy or the current standard setup invalid MUST be blocked. The impact report MUST
include the conflicting guardrail, affected tenant count, grouped conflict reasons, standard-setup
conflicts, and required remediation, and MUST NOT expose unrelated tenant business content.

#### Scenario: Block conflicting guardrail application

- **WHEN** a Platform Admin attempts to apply a guardrail that active tenant policies would violate
- **THEN** application is blocked
- **AND** the affected tenant count and grouped reasons are returned

#### Scenario: Block guardrails that invalidate the standard setup

- **WHEN** a Platform Admin attempts to apply limits that the current standard setup would violate
- **THEN** application is blocked
- **AND** the standard-setup conflicts are returned

#### Scenario: Impact report hides unrelated tenant content

- **WHEN** the guardrail impact report is produced
- **THEN** it exposes only the conflicting guardrail and aggregate counts, not tenant business data

### Requirement: Platform defaults are one quiet destination

The system SHALL expose one Platform Admin Performance defaults destination containing Standard setup
for new tenants and Advanced platform limits. Versioning MUST remain an internal guarantee rather than
the primary UI concept. A concise current-state or last-updated fact MAY be shown, but a dedicated
platform history browser is not required in P1.1. Platform Admin MUST NOT manage objective templates
or objective-template categories there.

#### Scenario: Authorization required for platform defaults

- **WHEN** a user without `PlatformRole.PlatformAdmin` attempts any platform-defaults operation
- **THEN** access is denied

#### Scenario: Platform Admin cannot manage tenant template content

- **WHEN** a Platform Admin uses Performance defaults
- **THEN** no platform starter-template or tenant template-management controls are exposed

### Requirement: Platform Defaults presents deterministic load and setup states

The Performance defaults destination SHALL resolve to exactly one deterministic state on load and
never present an ambiguous or blank surface. It MUST render the current applied standard setup and
advanced limits when they exist, and an explicit not-yet-configured state when they do not, rather
than showing empty or zeroed values as if applied. There is no Draft notion in this surface: it shows
only the current applied values plus any in-memory local edits. Reads never write, and refresh is not
required to see the truth.

#### Scenario: Healthy current setup on initial load

- **WHEN** a Platform Admin opens Performance defaults and current applied setup and limits exist
- **THEN** the current applied standard setup and advanced limits are shown

#### Scenario: Not-configured state when no setup exists

- **WHEN** a Platform Admin opens Performance defaults and no current standard setup exists
- **THEN** an explicit not-yet-configured state is shown
- **AND** empty or zeroed values are not presented as an applied setup

#### Scenario: Direct load and refresh reproduce applied state

- **WHEN** the destination is opened by direct URL or the page is refreshed
- **THEN** the same applied standard setup and advanced limits are shown
- **AND** no platform data is created or mutated by the load

### Requirement: Editing platform defaults has no Draft notion and applies atomically

Editing standard setup or advanced limits SHALL be a direct edit-and-apply interaction with no
persisted Draft lifecycle. Unsaved changes exist only as in-memory edits until the actor applies them.
Apply is a single atomic action that validates and creates the new applied state or blocks with no
partial mutation. Discarding MUST reset the in-memory edits back to the currently applied values.

#### Scenario: Apply is a single atomic action

- **WHEN** a Platform Admin edits values and applies
- **THEN** the change is validated and committed in one step with no intermediate Draft state

#### Scenario: Blocked or failed apply persists nothing

- **WHEN** an Apply is blocked by impact or fails validation
- **THEN** no Draft or partial state is persisted
- **AND** the currently applied values remain the only stored state

#### Scenario: Discard resets in-memory edits

- **WHEN** a Platform Admin discards their edits
- **THEN** the form resets to the currently applied values
- **AND** the applied standard setup and advanced limits remain unchanged

### Requirement: Applying platform changes evaluates impact before mutation and fails closed

Applying an advanced-limits change SHALL evaluate its impact on active tenant policies and the
current standard setup before any change to the applied state, and MUST fail closed on conflict. When
the proposed advanced limits would invalidate any active tenant policy or the current standard setup,
application MUST be blocked with no partial mutation. A standard-setup change affects only future
tenant provisioning and MAY be applied directly once it passes server-side validation against the
advanced limits; no tenant-impact review is required for standard setup.

#### Scenario: Standard setup applies directly after validation

- **WHEN** a Platform Admin applies a valid standard-setup change
- **THEN** it becomes the current standard setup without a separate manual review step
- **AND** existing tenant policies are not affected

#### Scenario: Limit below an active tenant value is blocked before mutation

- **WHEN** a Platform Admin applies an advanced limit that an active tenant policy would violate
- **THEN** application is blocked with no partial mutation
- **AND** the aggregate affected-tenant count and grouped reasons are shown without tenant business content

#### Scenario: Limits that invalidate the standard setup are blocked with exact fields

- **WHEN** a Platform Admin applies limits that the current standard setup would violate
- **THEN** application is blocked
- **AND** the exact conflicting standard-setup fields are identified

### Requirement: Platform Defaults failures preserve work and never fake success

Every Platform Defaults operation SHALL fail safely. A summary or load failure MUST be recoverable
without losing navigation. A retryable Apply failure MUST preserve the actor's in-memory entered
values, offer retry, and distinguish retryable failures from validation or impact failures. No
failure may clear valid entered values, expose a false success state, or present values that were
not actually applied.

#### Scenario: Retryable apply failure preserves entered values

- **WHEN** an Apply fails because of a retryable service error
- **THEN** the entered values remain visible and a retry action is offered
- **AND** the failure is distinguished from a validation or impact failure

#### Scenario: Failed apply leaves the applied setup as the only state

- **WHEN** an Apply fails or is blocked
- **THEN** the previously applied setup remains the current applied state
- **AND** no partial or unapplied state is persisted or shown as applied

#### Scenario: Retried application is idempotent

- **WHEN** an application request is retried after an ambiguous outcome
- **THEN** no duplicate applied state is created

#### Scenario: Malformed response is handled safely

- **WHEN** the server returns a malformed or unexpected response
- **THEN** a safe error is shown without exposing exception text
- **AND** no false success state is presented

### Requirement: Platform Defaults enforces Platform Admin authority continuously

Access to Platform Defaults SHALL be gated by `PlatformRole.PlatformAdmin` on every operation,
enforced server-side. Unauthenticated actors MUST be routed to authentication. Normal tenant users,
tenant admins, and tenant template managers MUST be denied. If the actor's authority is lost
mid-session, the next server operation MUST fail closed with an authorization error rather than
presenting a false success.

#### Scenario: Only Platform Admin may access Platform Defaults

- **WHEN** a normal tenant user, tenant admin, or tenant template manager attempts any Platform Defaults operation
- **THEN** access is denied server-side

#### Scenario: Authority lost mid-session fails closed

- **WHEN** an actor's `PlatformRole.PlatformAdmin` authority is revoked and they attempt a further operation
- **THEN** the operation is denied server-side without a false success state
