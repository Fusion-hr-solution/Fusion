# workforce-audit Specification

## Purpose

Defines the append-only, tenant-scoped `WorkforceAuditEntry`, transactional auditing of material workforce actions, deny-by-default audit access, and per-fact provenance.

## Requirements

### Requirement: WorkforceAuditEntry model

The system SHALL introduce an append-only, tenant-scoped `WorkforceAuditEntry` containing tenant, affected entity type and id, action, actor, timestamp, effective date when relevant, source/import reference, and concise change details. Entries SHALL NOT be updated or deleted. The system SHALL NOT introduce event sourcing, a message bus, a universal diff engine, or a generic audit framework in this milestone.

#### Scenario: Audit entry is append-only
- **WHEN** a workforce audit entry exists
- **THEN** it cannot be modified or deleted through application behavior

#### Scenario: Audit entry is tenant-scoped
- **WHEN** workforce audit entries are queried
- **THEN** only entries for the resolved tenant are returned

### Requirement: Material workforce actions are audited

The system SHALL write one concise `WorkforceAuditEntry` per material workforce action, in the same transaction as the underlying canonical change, for: employment creation, termination, and rehire; work assignment creation and change; manager change; import publication and correction; and org-unit responsible-manager change.

#### Scenario: Lifecycle action audited transactionally
- **WHEN** an employee is terminated, rehired, or has a manager change
- **THEN** a workforce audit entry is written in the same transaction as the canonical change

#### Scenario: Import publication audited
- **WHEN** an import batch is published
- **THEN** audit entries (or a publication audit record) reference the import batch/session

#### Scenario: Failed canonical change writes no audit
- **WHEN** a canonical change rolls back
- **THEN** no audit entry for that change is committed

### Requirement: Deny-by-default authorization for audit access

If `WorkforceAuditEntry` is exposed through any read API, that surface SHALL enforce server-side, deny-by-default authorization and tenant scoping. A caller without the required audit-view permission SHALL be denied, and SHALL only ever see audit entries for their own tenant.

#### Scenario: Audit read denied without permission
- **WHEN** a user without audit-view permission requests workforce audit entries
- **THEN** the request is denied

#### Scenario: Audit read is tenant-scoped
- **WHEN** an authorized user reads workforce audit entries
- **THEN** only entries for the caller's tenant are returned

### Requirement: Per-fact provenance

Each canonical workforce fact (`Employment`, `WorkAssignment`, `ManagerRelationship`) SHALL carry minimal provenance: a `SourceType`, an optional `SourceReference` or `ImportBatchId`, and standard created/updated audit metadata. Backfill-created facts SHALL carry migration provenance; import-published facts SHALL reference the import batch.

#### Scenario: Migrated fact carries migration provenance
- **WHEN** a canonical fact is created by backfill
- **THEN** its source provenance indicates migration

#### Scenario: Imported fact references its batch
- **WHEN** a canonical fact is created by import publication
- **THEN** its provenance references the import batch/session
