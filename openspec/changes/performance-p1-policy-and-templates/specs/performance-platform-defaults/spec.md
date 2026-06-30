## ADDED Requirements

### Requirement: Platform guardrails define hard system limits

The system SHALL maintain platform Performance guardrails that define hard, system-supported bounds
(minimum/maximum objective count, minimum/maximum manager-validation SLA, permitted percentage
precision, maximum allowed weighting values, supported measurement types, maximum template title and
description lengths, maximum tags, feature availability). Guardrails MUST NOT be tenant defaults;
tenant policies MAY only configure values within guardrails. Guardrail data is platform-owned,
carries no tenant identifier, and MUST be managed only by an actor holding `PlatformRole.PlatformAdmin`.

#### Scenario: Guardrails are read independently of tenant context

- **WHEN** a Platform Admin reads the active guardrails
- **THEN** the system returns the current guardrail values without requiring a tenant context

#### Scenario: Tenant endpoints cannot reach platform guardrails

- **WHEN** a tenant-scoped request attempts to read or modify platform guardrails
- **THEN** the request is rejected and no platform data is returned

### Requirement: Platform baseline policy is versioned

The system SHALL maintain a platform baseline objective policy with the lifecycle
Draft → Published → Superseded. Only one baseline version MAY be Published at a time, and a Published
baseline version MUST be immutable. The baseline defines recommended initial values for newly
provisioned tenants and MUST NOT silently overwrite existing tenant policy.

#### Scenario: Publish a valid baseline

- **WHEN** a Platform Admin publishes a valid baseline Draft
- **THEN** the Draft becomes the Published baseline
- **AND** any previously Published baseline becomes Superseded

#### Scenario: Published baseline is immutable

- **WHEN** an actor attempts to edit a Published baseline version
- **THEN** the edit is rejected and a new Draft must be created instead

### Requirement: Guardrail changes run impact analysis and fail closed on conflict

Before publishing a guardrail change, the system SHALL run impact analysis against active tenant
policies. A guardrail change that would make an existing active tenant policy invalid MUST be blocked
unless a separate governed migration is provided. The impact report MUST include the conflicting
guardrail, affected tenant count, representative conflict reasons, and required remediation, and MUST
NOT expose unrelated tenant business content.

#### Scenario: Block conflicting guardrail publication

- **WHEN** a Platform Admin attempts to publish a guardrail that active tenant policies would violate
- **THEN** publication is blocked
- **AND** the affected tenant count and representative reasons are returned

#### Scenario: Impact report hides unrelated tenant content

- **WHEN** the guardrail impact report is produced
- **THEN** it exposes only the conflicting guardrail and aggregate counts, not tenant business data

### Requirement: Platform starter-template pack

The system SHALL allow Platform Admin to manage an optional platform starter-template pack with
stable identities and versioned revisions. Starter templates are platform-owned, MUST contain no
tenant-specific organization, employee, or job data, and MUST keep applicability tenant-neutral.

#### Scenario: Manage starter template revisions

- **WHEN** a Platform Admin creates, activates, revises, or archives a starter template
- **THEN** the platform starter-template pack reflects the change with versioned revisions preserved

#### Scenario: Authorization required for platform defaults

- **WHEN** a user without `PlatformRole.PlatformAdmin` attempts any platform-defaults operation
- **THEN** access is denied
