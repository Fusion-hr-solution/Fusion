## ADDED Requirements

### Requirement: Objective-template categories

The system SHALL provide tenant-scoped objective-template categories, each with a stable identifier,
a tenant-unique code, a tenant-unique normalized display name, optional description, and an
Active → Archived lifecycle. Archived categories MUST NOT be selectable for new templates while
existing templates retain them. A category referenced by templates MUST NOT be hard-deleted.
Re-activating an archived category requires explicit permission and is audited. Categories are flat
in this partition.

#### Scenario: Create a category

- **WHEN** an authorized user creates a category with a unique valid code and name
- **THEN** the category becomes Active and is available to template Drafts

#### Scenario: Reject duplicate category code

- **WHEN** a user creates a category whose code already exists in the tenant
- **THEN** the operation is rejected with a deterministic error

#### Scenario: Archive a used category safely

- **WHEN** a user archives a category referenced by active templates
- **THEN** existing templates retain it
- **AND** new templates cannot select it

### Requirement: Stable template identity with immutable revisions

An objective template SHALL have a stable tenant-scoped identity (template Draft → Active → Archived)
separate from its content, which lives in revisions (revision Draft → Active → Superseded). A new
template begins with one editable Draft revision. The active revision MUST be immutable; editing an
Active template creates or opens a new Draft revision. Activating a Draft revision validates it, makes
it the active revision, supersedes the previous active revision while preserving it, keeps the same
stable identity, and writes audit entries.

#### Scenario: Edit an Active template through a new revision

- **WHEN** an authorized user edits an Active template
- **THEN** the Active revision remains unchanged
- **AND** a new Draft revision is created

#### Scenario: Activate a revised template

- **WHEN** a user activates a valid Draft revision
- **THEN** it becomes the Active revision
- **AND** the prior Active revision becomes Superseded

### Requirement: Template content by measurement type

Every template Draft SHALL require a title, measurement type, and primary category. A Quantitative template
requires an indicator, a target definition, and a unit before activation. A Qualitative template
requires an expected outcome and success criteria before activation. Suggested weighting is optional
but MUST use a value allowed by the Active tenant policy. Templates MUST NOT contain participant,
manager, or employee-specific data, tenant-external workforce identifiers, hard-coded campaign dates,
progress values, review ratings, or Key Results presented as full OKR support.

#### Scenario: Create and activate a Quantitative template

- **WHEN** Quantitative measurement is enabled and a user provides indicator, target, and unit
- **THEN** the Draft can be activated as an immutable Active revision

#### Scenario: Block an incomplete Quantitative template

- **WHEN** a user attempts to activate a Quantitative template without a target or unit
- **THEN** activation is blocked

#### Scenario: Create a Qualitative template

- **WHEN** Qualitative measurement is enabled and a user provides expected outcome and success criteria
- **THEN** the Draft can be activated

### Requirement: Template applicability references canonical Core dimensions

Applicability SHALL control where a template is recommended or offered and MUST NOT become a duplicate
workforce model or grant application permission. Applicability MAY reference all tenant employees,
selected organizational units, organizational subtrees, canonical job titles, locations, employment
types, and tenant-owned tags. Org units and other stable Core records MUST be referenced using
Core-provided stable identifiers; Performance MAY retain display labels but MUST NOT treat labels as
canonical identifiers. A template with no restrictive applicability is tenant-wide. A template MUST
NOT be activated with unresolved or cross-tenant references.

#### Scenario: Reject cross-tenant applicability

- **WHEN** a template Draft references an org unit from another tenant and activation is attempted
- **THEN** activation is rejected without disclosing foreign tenant data

#### Scenario: Empty applicability is tenant-wide

- **WHEN** a template is activated with no restrictive applicability
- **THEN** it is treated as available tenant-wide

#### Scenario: Draft preserves a temporarily unresolved reference with a blocking state

- **WHEN** a Draft holds an applicability reference that does not currently resolve
- **THEN** the Draft can be saved with a blocking validation state on that reference
- **AND** activation remains blocked until the reference resolves

### Requirement: Template search, filtering, and pagination

The template library SHALL support keyword search over title, stable code, description, and tags;
filters for category, status, measurement type, tag, and applicability where practical; sorting by
recently updated and by title; and server-side pagination. The default view prioritizes Active
templates while Draft and Archived remain available through status filters for authorized users.

#### Scenario: Search returns matching templates with pagination

- **WHEN** an authorized user searches and filters the library
- **THEN** matching templates are returned using server-side pagination prioritizing Active templates

### Requirement: Template duplication

Authorized users SHALL be able to duplicate a template. Duplication MUST create a new stable identity
and a new Draft revision, copy content and applicability, generate or request a new stable code,
preserve a source-template reference for audit, not copy lifecycle history, and not create an Active
template automatically.

#### Scenario: Duplicate a template

- **WHEN** a user duplicates an existing template
- **THEN** a new Draft template identity is created
- **AND** the source remains unchanged

### Requirement: Template archive and constrained hard deletion

Archiving a template SHALL prevent future selection, preserve all revisions and future copied-objective
links, require confirmation, and be audited. Hard deletion is permitted only when the template has
never been activated, has no external reference, remains an unused Draft, and the actor has
permission; activated or referenced templates MUST be archived instead.

#### Scenario: Archive an Active template

- **WHEN** an authorized user archives an Active template
- **THEN** it becomes unavailable for future selection
- **AND** its history is preserved

#### Scenario: Reject hard deletion of an activated template

- **WHEN** a user attempts to hard-delete a template that has been activated
- **THEN** the deletion is rejected and archival is required instead

### Requirement: Resilient and accessible configuration workflows

Configuration forms (template editor and policy editor) SHALL preserve entered values when a save or
publish fails because of a retryable service error, distinguish retryable failures from validation
failures, and offer a retry action where safe, without exposing technical stack traces. Every
configuration workflow MUST be fully operable by keyboard with logical focus order, visible focus
indicators, programmatic error association, and conformance to WCAG 2.2 AA.

#### Scenario: Preserve form after a retryable service failure

- **WHEN** a user has entered valid Draft changes and the save fails because of a retryable service error
- **THEN** the entered values remain visible
- **AND** a retry action is available

#### Scenario: Keyboard-complete template workflow

- **WHEN** a keyboard-only user creates, validates, and saves a template Draft
- **THEN** the full workflow is operable without a pointer device

### Requirement: Authorization and tenant isolation for templates and categories

Every template and category operation MUST enforce permission server-side and require authoritative
tenant context. Cross-tenant identifiers MUST be rejected without revealing whether the referenced
record exists. Hiding UI controls is not authorization.

#### Scenario: Deny unauthorized template management

- **WHEN** a user without template-management permission attempts to create or activate a template
- **THEN** access is denied
