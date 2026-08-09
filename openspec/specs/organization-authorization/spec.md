# organization-authorization Specification

## Purpose

Defines tenant-scoped, capability-based access to canonical Organization data and operations.

## Requirements

### Requirement: Capability-based Organization access

Core HR SHALL enforce tenant-scoped, deny-by-default `Organization.View` and `Organization.Manage` capabilities. Manage SHALL include View and SHALL authorize Organization creation, Change, Move, inactivation, cancellation, Correction, code correction, and custom-type management. View SHALL authorize read-only hierarchy, detail, search, history, upcoming-change, type, and readiness access.

#### Scenario: View-only caller cannot mutate

- **WHEN** a caller has Organization.View but not Organization.Manage
- **THEN** read queries succeed and every Organization mutation is forbidden

#### Scenario: No capability fails closed

- **WHEN** a caller has neither Organization capability
- **THEN** Organization queries and commands are denied before data is returned or changed

### Requirement: No role or legacy publish authorization fallback

Canonical Organization endpoints SHALL authorize through capability policy evaluation only. `HRAdmin` role attributes, `Structure.View`, `Structure.Manage`, `Structure.Publish`, and setup/publish permissions SHALL NOT grant canonical Organization access. `Structure.Publish` SHALL be removed with the obsolete draft/publish workflow.

#### Scenario: Legacy publish grant does not authorize Move

- **WHEN** a caller only holds the former Structure.Publish permission
- **THEN** the canonical Move command is forbidden

### Requirement: Initial tenant-administrator grants

Identity access-profile seeding SHALL grant Tenant Administrator both tenant-scoped Organization capabilities. Platform Administrator status alone SHALL NOT grant a customer tenant's Organization access.

#### Scenario: Tenant Administrator manages organization

- **WHEN** a Tenant Administrator acts in its tenant
- **THEN** Organization queries and management commands are authorized through the seeded Organization grants

#### Scenario: Platform-only administrator denied

- **WHEN** a Platform Administrator has no explicit tenant Organization grant
- **THEN** the Organization API denies access
