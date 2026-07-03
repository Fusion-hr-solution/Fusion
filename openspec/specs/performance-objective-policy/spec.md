# performance-objective-policy Specification

## Purpose

Defines the tenant-owned objective policy behavior for P1.1: current policy, local edits, review and
Apply, immutable applied versions, server-side validation, compatibility checks, and minimal version
history.

## Requirements

### Requirement: Tenant objective policy uses a current-policy and Apply workflow

The system SHALL maintain one current Active objective policy per tenant. The user-facing flow is
current policy -> edit locally -> review validation and impact -> Apply. Local edits MUST NOT change
the current Active version until Apply succeeds. Each successful Apply atomically creates a new
immutable Active version and supersedes the prior Active version. Leaving or cancelling local edits
MUST NOT affect the current policy. All operations require authoritative tenant context and fail
closed without it.

#### Scenario: Edit the current policy without changing it

- **WHEN** a Tenant Admin starts editing the current policy
- **THEN** the edits remain local
- **AND** the current Active policy remains unchanged

#### Scenario: Apply a valid policy change

- **WHEN** an authorized Tenant Admin applies a valid policy change
- **THEN** a new Active version is created
- **AND** the prior Active version becomes Superseded

#### Scenario: Cancel preserves the current policy

- **WHEN** a Tenant Admin cancels local edits that were not applied
- **THEN** the current Active policy remains unchanged

#### Scenario: Reject unauthorized Apply

- **WHEN** a user without policy-management permission attempts to apply a policy change
- **THEN** access is denied

### Requirement: Policy fields

A tenant objective policy SHALL contain: maximum objectives per employee plan; allowed weighting
values as percentages; manager review SLA in business days; strategic-alignment mode of `Disabled`,
`Optional`, or `Required`; a non-empty combination of measurement types from {Quantitative,
Qualitative}; and attachments set to Enabled or Disabled.

#### Scenario: Policy exposes all required fields

- **WHEN** the current policy is read
- **THEN** it returns objective count, allowed weights, SLA, strategic-alignment mode, measurement types, and attachments

### Requirement: Policy validation

Applying a policy MUST be rejected when: the maximum objective count is below the platform minimum or
above the platform maximum; allowed weight values are empty; any weight is below 1 or above 100; any
weight exceeds platform precision; allowed weights contain duplicates; enabled measurement types are
empty; the manager review SLA is outside platform guardrails; the configuration cannot produce a 100%
plan within the maximum objective count; active-template compatibility checks fail; or optimistic
concurrency fails. Validation MUST be server-side and return deterministic error codes.

#### Scenario: Reject empty measurement types

- **WHEN** a Tenant Admin attempts to apply a policy with no enabled measurement types
- **THEN** the application is rejected with a deterministic error

#### Scenario: Reject duplicate or out-of-range weights

- **WHEN** allowed weights contain a duplicate or a value below 1 or above 100
- **THEN** the application is rejected with a deterministic error

### Requirement: Weight feasibility

The policy MUST prove that at least one valid combination of allowed weights can total exactly 100%
without exceeding the maximum objective count. The check MUST be deterministic and server-side.

#### Scenario: Block an impossible weight policy

- **WHEN** allowed weights are {30, 40} and maximum objectives is 2
- **THEN** application is blocked with a specific explanation that no combination totals 100%

### Requirement: Policy compatibility with active templates

Before Apply, the system MUST inspect active template revisions and block the change when the
proposed policy would make an active template invalid, including when a measurement type would be
disabled, a suggested weighting would no longer be allowed, or another policy rule would make the
active revision structurally invalid. The result MUST list affected templates and the conflicting
field, and MUST NOT silently modify templates.

#### Scenario: Block policy that conflicts with active templates

- **WHEN** active Quantitative templates exist and a Tenant Admin disables the Quantitative measurement type
- **THEN** application is blocked
- **AND** the affected templates and conflicting field are listed

### Requirement: Fixed P1 rules and concurrency

The system SHALL enforce the following rules, which are not tenant-configurable: objective title
maximum of 150 characters; objective description maximum of 500 characters; submitted plan total must
equal 100%; tenant isolation; and server-side validation. State-changing policy operations MUST use
optimistic concurrency, and a stale update MUST be rejected with a deterministic conflict response
while preserving current server state. Retrying a successful Apply MUST NOT create a duplicate version.

#### Scenario: Reject a stale policy Apply

- **WHEN** two users edit the same current policy and the second applies against stale state
- **THEN** the update is rejected
- **AND** the current server state is preserved

#### Scenario: Idempotent application

- **WHEN** a successful application request is retried
- **THEN** no duplicate policy version is created

### Requirement: Policy history is minimal and read-only

The system SHALL provide a simple read-only policy version history sufficient to show which version
is current, when each version was applied, who applied it, and a concise change summary. A generic
audit browser or advanced version comparison tool is not required in P1.1.

#### Scenario: Read policy history

- **WHEN** an authorized user opens policy history
- **THEN** the current and previous versions are returned with applied date, actor, and concise change summary

### Requirement: Tenant policy interaction and failure states

The objective-policy surface SHALL resolve to a deterministic state and protect user work. When the
tenant has no provisioned policy, the read view MUST show an explicit not-provisioned state rather
than an empty or zeroed policy, and MUST NOT create a policy as a side effect. Before Apply, the
surface MUST present validation and active-template impact review. A blocked or retryable failure MUST
preserve entered values, distinguish failure types, and MUST NOT present a false success. The surface
MUST be safe to open by direct URL and reproduce state after refresh.

#### Scenario: Not-provisioned policy shows an explicit state

- **WHEN** an authorized user opens the objective policy for a tenant with no provisioned policy
- **THEN** an explicit not-provisioned state is shown
- **AND** no policy is created by the read

#### Scenario: Apply is gated by validation and impact review

- **WHEN** a Tenant Admin attempts to apply local policy changes
- **THEN** weight feasibility and active-template compatibility are reviewed before the policy is made Active
- **AND** a conflict blocks application while preserving entered values

#### Scenario: Unsaved-changes protection on the policy editor

- **WHEN** a Tenant Admin has unsaved local policy edits and attempts to navigate away or reload
- **THEN** an accurate unsaved-changes warning is shown

#### Scenario: Retryable Apply failure preserves entered values

- **WHEN** a retryable service error occurs while applying valid local changes
- **THEN** the entered values remain visible
- **AND** a safe retry is offered without exposing exception text

#### Scenario: Isolated policy-history load failure

- **WHEN** policy history fails to load
- **THEN** the failure is contained and policy editing remains usable
