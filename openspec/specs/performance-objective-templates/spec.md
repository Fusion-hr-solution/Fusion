# performance-objective-templates Specification

## Purpose

Defines the tenant-owned template library for P1.1: categories, template identity and revisions,
measurement-specific content, MVP applicability, basic discovery, duplication, archive behavior, and
safe authoring workflows.

## Requirements

Objective templates and categories are tenant-owned business content managed by authorized tenant HR
or Performance administrators. Platform Admin does not manage starter templates in P1.1.

### Requirement: Objective-template categories

The system SHALL provide tenant-scoped objective-template categories, each with a stable identifier,
a tenant-unique code, a tenant-unique normalized display name, optional description, and an
Active → Archived lifecycle. Archived categories MUST NOT be selectable for new templates while
existing templates retain them. A category referenced by templates MUST NOT be hard-deleted.
Re-activating an archived category requires explicit permission and is audited. Categories are flat
in this partition.

#### Scenario: Create a category

- **WHEN** an authorized user creates a category with a unique valid code and name
- **THEN** the category becomes Active and is available to template authoring

#### Scenario: Reject duplicate category code

- **WHEN** a user creates a category whose code already exists in the tenant
- **THEN** the operation is rejected with a deterministic error

#### Scenario: Archive a used category safely

- **WHEN** a user archives a category referenced by active templates
- **THEN** existing templates retain it
- **AND** new templates cannot select it

### Requirement: Stable template identity with immutable revisions

An objective template SHALL have a stable tenant-scoped identity separate from its content, which
lives in revisions. A new template begins with one editable Draft revision. The active revision MUST
be immutable; editing an Active template creates or opens a new Draft revision. Activating a Draft
revision validates it, makes it the Active revision, supersedes the previous Active revision while
preserving it, keeps the same stable identity, and writes lifecycle records. Stable template codes
are system-generated and are not required manual input in the normal workflow.

#### Scenario: Edit an Active template through a new revision

- **WHEN** an authorized user edits an Active template
- **THEN** the Active revision remains unchanged
- **AND** a new Draft revision is created

#### Scenario: Activate a revised template

- **WHEN** a user activates a valid Draft revision
- **THEN** it becomes the Active revision
- **AND** the prior Active revision becomes Superseded

### Requirement: Template content by measurement type

Every template Draft SHALL require a title, measurement type, and primary category. A Quantitative
template requires an indicator, a target definition, and a unit before activation. A Qualitative
template requires an expected outcome and success criteria before activation. Suggested weighting is
optional but MUST use a value allowed by the Active tenant policy. Templates MUST NOT contain
participant, manager, or employee-specific data, tenant-external workforce identifiers, hard-coded
campaign dates, progress values, review ratings, or Key Results presented as full OKR support.

#### Scenario: Create and activate a Quantitative template

- **WHEN** Quantitative measurement is enabled and a user provides indicator, target, and unit
- **THEN** the Draft can be activated as an immutable Active revision

#### Scenario: Block an incomplete Quantitative template

- **WHEN** a user attempts to activate a Quantitative template without a target or unit
- **THEN** activation is blocked

#### Scenario: Create a Qualitative template

- **WHEN** Qualitative measurement is enabled and a user provides expected outcome and success criteria
- **THEN** the Draft can be activated

### Requirement: Template applicability supports the P1.1 MVP contract

Applicability SHALL control where a template is recommended or offered and MUST NOT become a
duplicate workforce model or grant permission. P1.1 requires tenant-wide applicability and selected
Core organizational units with an explicit scope of this unit only or this unit and descendants. A
template with no restrictive applicability is tenant-wide. Performance MAY retain display labels but
MUST reference Core organizational units by stable Core identifiers. A template MUST NOT be activated
with unresolved or cross-tenant organizational-unit references.

#### Scenario: Tenant-wide applicability by default

- **WHEN** a template is activated with no restrictive applicability
- **THEN** it is treated as available tenant-wide

#### Scenario: Organizational scope preserves descendant choice

- **WHEN** a user selects one or more organizational units and chooses unit-only or unit-and-descendants
- **THEN** that explicit scope is preserved for later evaluation

#### Scenario: Reject cross-tenant applicability

- **WHEN** a template Draft references an org unit from another tenant and activation is attempted
- **THEN** activation is rejected without disclosing foreign tenant data

### Requirement: Optional extended applicability dimensions are constrained

The system SHALL treat any additional applicability dimensions exposed beyond the P1.1 MVP
requirement, such as job title, work location, or employment type, as optional extensions and MUST
NOT redefine P1.1 completion around them. When such dimensions are present, values within one
dimension MUST combine as alternatives, populated dimensions MUST combine restrictively, and a value
that later disappears from current Core data becomes a no-match warning rather than a
foreign-reference error.

#### Scenario: Multiple populated dimensions combine restrictively

- **WHEN** a template specifies more than one populated applicability dimension
- **THEN** recommendation requires the populated dimensions to be satisfied together

#### Scenario: Disappeared string value is a recommendation miss

- **WHEN** a string-based applicability value referenced by an Active template no longer exists in current Core data
- **THEN** the Active template remains valid and the change is treated as a recommendation miss

### Requirement: Template search, filtering, and pagination match the MVP library contract

The template library SHALL support keyword search over at least title and description, basic filters
for category, status, and measurement type, server-side pagination, and one predictable default sort
that prioritizes active content. Stable code MAY also be searchable but is not the primary user
concept. Saved views, advanced filter combinations, bulk actions, and complex ranking are not
required for P1.1 acceptance.

#### Scenario: Search returns matching templates with pagination

- **WHEN** an authorized user searches and filters the library
- **THEN** matching templates are returned using server-side pagination
- **AND** Active templates are prioritized by default

### Requirement: Template duplication

Authorized users SHALL be able to duplicate a template. Duplication MUST create a new stable
identity and a new Draft revision, copy content and applicability, generate a new stable code,
preserve a source-template reference for traceability, not copy lifecycle history, and not create an
Active template automatically.

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

Configuration forms SHALL preserve entered values when a save or activation fails because of a
retryable service error, distinguish retryable failures from validation failures, and offer a retry
action where safe, without exposing technical stack traces. Every configuration workflow MUST be
fully operable by keyboard with logical focus order, visible focus indicators, programmatic error
association, and conformance to WCAG 2.2 AA.

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

### Requirement: Template library and editor interaction states

The template library and editor SHALL present deterministic states across the interaction surface. An
empty library MUST show an explicit empty state that invites creating the first template rather than a
blank list; a search or filter yielding nothing MUST show a distinct no-results state that is
recoverable by clearing filters. A user with view-only permission MUST see a read-only library and
editor. In the editor, changing the measurement type of a Draft MUST warn that measurement-specific
content may be cleared or invalidated before the change is applied. A Draft MAY be saved while
incomplete; completeness is enforced only at activation. The library and editor MUST be safe to open
by direct URL and reproduce state after refresh.

#### Scenario: Empty library versus no-results are distinct

- **WHEN** the library has no templates, and separately when a search yields no matches
- **THEN** an empty-library state invites first creation, and a no-results state is recoverable by clearing filters

#### Scenario: View-only access is read-only

- **WHEN** a user with only view permission opens the library and a template
- **THEN** management controls are absent and any management operation is denied server-side

#### Scenario: Measurement-type switch warns before clearing content

- **WHEN** a user changes the measurement type of a Draft with entered measurement-specific content
- **THEN** a warning is shown that the content may be cleared or invalidated before the change is applied

#### Scenario: Incomplete Draft is saveable

- **WHEN** a user saves a Draft that is not yet complete for activation
- **THEN** the Draft is saved and completeness is enforced only at activation

#### Scenario: Unknown template identifier resolves to not-found

- **WHEN** a template editor is opened by direct URL with an unknown or cross-tenant identifier
- **THEN** a not-found state is shown without disclosing foreign tenant data
