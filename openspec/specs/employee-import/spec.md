# employee-import Specification

## Purpose

Defines staged, two-level-validated, all-or-nothing employee import that writes canonical workforce facts only at publication, with batch effective date, import mode, change-set preview, and deny-by-default authorization.

## Requirements

### Requirement: Import staging without canonical writes

Employee import SHALL stage uploaded file metadata, source headers, every source row, parse results, row and batch validation results, normalized canonical draft records (employee profile, employment, work assignment, manager relationship), and a proposed-changes preview. No canonical workforce data SHALL change during staging or validation.

#### Scenario: Upload stages rows without canonical writes
- **WHEN** an operator uploads an import file
- **THEN** the session stores source rows and metadata
- **AND** no `Employee`, `Employment`, `WorkAssignment`, or `ManagerRelationship` record is created or modified

#### Scenario: Staging stores canonical draft records
- **WHEN** validation produces normalized rows
- **THEN** the normalized rows represent canonical draft records, not legacy direct employee fields

#### Scenario: Import session is tenant-scoped
- **WHEN** an import session is accessed from a different tenant
- **THEN** the fail-closed tenant filter prevents access

### Requirement: Two-level import validation

The system SHALL validate imports at row level (required fields, formats, valid dates, valid org unit code, valid manager email format, row-local employment/assignment consistency) and batch level (duplicate emails/employee numbers in file, duplicate keys against tenant, manager references to same-file or existing employees, manager cycles across existing and same-file employees, one active employment per employee, one primary work assignment per active employment, valid effective-date windows, no cross-tenant references). Blocking errors SHALL prevent publication. Warnings SHALL be non-blocking only when explicitly defined and unable to compromise canonical workforce truth, tenant isolation, or required facts.

#### Scenario: Blocking error prevents publication
- **WHEN** any row or batch validation produces a blocking error
- **THEN** publication is not permitted until the error is resolved

#### Scenario: Manager cycle across batch detected
- **WHEN** rows in the batch combined with existing employees would form a manager cycle
- **THEN** validation reports a blocking error

#### Scenario: Cross-tenant reference rejected
- **WHEN** a row references an org unit or manager outside the tenant
- **THEN** validation reports a blocking error

### Requirement: Create and controlled-update matching by employee number

The system SHALL match rows to existing employees by tenant-scoped `EmployeeNumber` and classify each validated row as Create, Unchanged, ProfileCorrection, EmploymentChange, WorkAssignmentChange, ManagerChange, Invalid, or Conflicting. A duplicate employee number within the file SHALL be a blocking error. A missing employee number SHALL be allowed only when import policy explicitly permits create-without-number; email alone SHALL NOT be used for update matching. Business changes SHALL create or close effective-dated records rather than overwrite history; corrections SHALL be explicit, validated, and audited. Missing rows SHALL NOT imply deletion or termination.

#### Scenario: Existing employee matched and classified
- **WHEN** a row's employee number matches exactly one existing employee in the tenant
- **THEN** the row is classified against that employee as Unchanged, a correction, or a business change

#### Scenario: New employee classified as create
- **WHEN** a row's employee number matches no existing employee and other uniqueness checks pass
- **THEN** the row is classified as Create

#### Scenario: Duplicate employee number in file blocks
- **WHEN** two rows in the file share the same employee number
- **THEN** validation reports a blocking error

#### Scenario: Missing rows are not destructive
- **WHEN** an existing employee is absent from the uploaded file
- **THEN** the employee's employment, assignment, and manager are not ended or deleted

### Requirement: Batch effective date with optional row override

The import session SHALL carry one required `BatchEffectiveDate`. The template MAY include an optional row-level `effectiveDate` that overrides the batch date for that row and applies to all business changes in the row (never per individual field). The resolved effective date SHALL be shown per row in preview and validated against existing employment/assignment/manager history. Changing the batch effective date after validation SHALL require revalidation.

#### Scenario: Batch date required before validation
- **WHEN** validation or publication is attempted without a batch effective date
- **THEN** the system rejects it with a blocking error

#### Scenario: Row override applies to the whole row
- **WHEN** a row provides an effective-date override
- **THEN** that date applies to the row's employment, work assignment, and manager business changes
- **AND** the resolved effective date is shown in preview

#### Scenario: Changing batch date invalidates prior validation
- **WHEN** the batch effective date changes after validation
- **THEN** the session requires revalidation before publication

### Requirement: Batch-level import mode

The import session SHALL carry a batch-level `ImportMode` of `BusinessChange` (default) or `Correction`. A single batch SHALL NOT mix corrections and business changes. `BusinessChange` SHALL create or close effective-dated records without overwriting history; `Correction` SHALL apply minimal, explicit, audited corrections and SHALL be rejected when the system cannot prove which existing fact is being corrected safely. There SHALL be no row-level change-type column.

#### Scenario: Business change creates effective-dated records
- **WHEN** a `BusinessChange` batch publishes a manager or organization change
- **THEN** effective-dated records are created or closed as of the resolved effective date without overwriting historical facts

#### Scenario: Correction is explicit and audited
- **WHEN** a `Correction` batch amends an incorrect existing value
- **THEN** the correction is linked to the import batch and audited
- **AND** it does not create unrelated business events

#### Scenario: Unsafe correction rejected
- **WHEN** a correction cannot be proven to map to a specific existing fact safely
- **THEN** the system rejects the row with a blocking error

### Requirement: All-or-nothing batch publication

Publication SHALL re-verify the validated session, re-run critical conflict checks, and write the complete validated change set atomically within a transaction, then write publication history and mark the session applied. If any write fails, the transaction SHALL roll back and canonical workforce data SHALL remain unchanged. The system SHALL NOT publish valid rows while skipping invalid ones. History SHALL preserve upload, validation, and publication attempts and SHALL use explicit counts (`SourceRowCount`, `ValidatedRowCount`, `BlockingErrorCount`, `WarningCount`, `PublishedRowCount`) and an explicit `Status`; `SkippedCount` and partial-success "skipped" semantics SHALL NOT survive the final implementation.

#### Scenario: Atomic publication of the whole batch
- **WHEN** a validated batch with no blocking errors is published
- **THEN** all canonical records for the batch are written in one transaction
- **AND** publication history records the classification and publication counts

#### Scenario: Failed publication leaves data unchanged
- **WHEN** a write fails during publication
- **THEN** the transaction rolls back and no canonical workforce data is changed
- **AND** a failed publication attempt is recorded where supported

#### Scenario: No partial-row publication
- **WHEN** a batch contains any blocking error
- **THEN** no rows are published

### Requirement: Deny-by-default authorization for import

Every import stage — upload, validate, preview, and publish — SHALL enforce server-side, deny-by-default authorization and tenant scoping. A caller without the required import permission SHALL be denied at each stage, and import sessions SHALL only be accessible within the owning tenant.

#### Scenario: Import stage denied without permission
- **WHEN** a user without the required import permission attempts upload, validate, preview, or publish
- **THEN** the request is denied at that stage

#### Scenario: Publish requires permission even after validation
- **WHEN** a user without publish permission attempts to publish an already-validated session
- **THEN** the request is denied and no canonical workforce data is written

#### Scenario: Import session not accessible cross-tenant
- **WHEN** a user attempts to access an import session belonging to another tenant
- **THEN** access is denied by the fail-closed tenant filter

### Requirement: Import change-set preview

Preview SHALL present the complete proposed canonical change set: employees to create or update, employments to create/end, work assignments to create/end/change, manager relationships to create/end/change, unresolved references, blocking errors, warnings, batch-level conflicts, row classification, matched employee identity where applicable, and the resolved effective date. Preview SHALL NOT imply that valid rows publish independently of invalid rows.

#### Scenario: Preview shows full proposed change set
- **WHEN** an operator previews a validated batch
- **THEN** the preview lists proposed creates/changes per row with classification, resolved effective date, errors, and warnings

#### Scenario: Preview reflects all-or-nothing semantics
- **WHEN** the batch contains blocking errors
- **THEN** the preview indicates the batch cannot be published until the errors are resolved
