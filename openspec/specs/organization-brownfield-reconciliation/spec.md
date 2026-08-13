# organization-brownfield-reconciliation Specification

## Purpose

Defines removal of the former Draft Structure/publish authority and the clean-slate development-data transition.

## Requirements

### Requirement: One canonical Organization authority

Core HR SHALL retain exactly one authoritative Organization truth: the stable Organizational Unit identities and their effective states. `DraftOrgUnit`, Draft Structure, draft import, and TenantSetup publish/replace workflows SHALL NOT create, overwrite, deactivate, or otherwise replace canonical Organization state.

#### Scenario: Draft publish cannot replace Organization

- **WHEN** a legacy Draft Structure publish/reopen/replace path is invoked after this change
- **THEN** it cannot mutate canonical Organization truth

### Requirement: Disposable development-data transition

The implementation SHALL use a clean-slate development migration/reset posture for obsolete mutable OrgUnit, Draft Structure, published-structure, and setup-governance data. It SHALL not invent historical effective states or retain duplicate-name/replace semantics merely to preserve development contents.

#### Scenario: Recreated development database

- **WHEN** a development database is recreated for this change
- **THEN** the canonical Organization schema is present without requiring migration of old draft/live structure contents

### Requirement: Bounded temporary compatibility

The temporary compatibility period for Draft Structure and TenantSetup Organization authority SHALL be closed before new Organization Import persistence is introduced. Active runtime source, EF model/snapshot, tests, shared contracts, and frontend routes SHALL NOT contain a mutable draft hierarchy, draft import session, DraftStructureSchema setting, setup-phase readiness, published-structure version, or publish/approve/reopen authority. A live consumer of retired state SHALL be removed when the concept is redundant or migrated only when an observable behavior has a canonical Organization equivalent. Historical migration and designer files SHALL remain immutable as database history.

#### Scenario: Remaining live dependency is reconciled

- **WHEN** a current runtime contract still queries retired setup state only to return unconsumed `PublishedStructureVersion` or `IsStructureOperational` fields
- **THEN** those redundant fields and the query are removed and the remaining workforce contract is regression-tested before the retired type is deleted
- **AND** Fusion does not invent a replacement version or readiness field with no canonical consumer need

#### Scenario: Active legacy residue is removed

- **WHEN** repository stale-authority searches run after this change
- **THEN** no active backend, frontend, shared API, EF current model/snapshot, or test source references DraftOrgUnit, DraftStructureImportSession, Draft Structure mutation/import, TenantSetup publish/approve/reopen, draft readiness, or `/setup/draft-structure`
- **AND** Organization Import cannot bind to a retired entity or authority

#### Scenario: Historical migrations remain valid

- **WHEN** a clean database replays CoreHR migrations
- **THEN** historical migrations may retain legacy type/table names as immutable history
- **AND** the current EF model and latest snapshot do not recreate those retired tables

#### Scenario: Independent Employee Import remains separate

- **WHEN** legacy Organization authority is removed
- **THEN** Employee Import remains operational and independent
- **AND** its stepper, preview, partial apply, and workflow semantics do not become Organization Import behavior
