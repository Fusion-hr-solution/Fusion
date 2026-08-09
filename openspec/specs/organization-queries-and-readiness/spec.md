# organization-queries-and-readiness Specification

## Purpose

Defines tenant-scoped as-of Organization queries, scheduled-change/history contracts, and derived readiness.

## Requirements

### Requirement: Coherent as-of Organization queries

Core HR SHALL expose tenant-scoped Organization queries for a supplied calendar date: resolved hierarchy, unit detail, and Organization-scoped search. Before any root exists, or before a scheduled root becomes effective, the hierarchy query SHALL return a valid empty active hierarchy. From root effectiveness onward, each response SHALL resolve hierarchy, parent/path, lifecycle, type, details, and search context from the same date and SHALL provide structural data sufficient for later Chart and Outline representations.

#### Scenario: Duplicate-name-safe search

- **WHEN** Organization search returns two units with the same name
- **THEN** each result includes stable code and/or resolved hierarchy path sufficient to distinguish it

#### Scenario: Future detail is coherent

- **WHEN** a caller requests hierarchy and unit detail as of a future date with scheduled changes
- **THEN** both responses resolve the same future parent/type/name/lifecycle truth

### Requirement: Upcoming changes and business-history queries

The system SHALL expose tenant-wide upcoming Organization changes and unit business history. Each upcoming change SHALL include its stable scheduled-operation identifier, effective date, affected unit, operation, and meaningful before/after context. The API SHALL support safe cancellation of the specifically identified operation only for a caller with Organization.Manage and a cancellable state.

#### Scenario: No future changes

- **WHEN** no scheduled Organization state exists after today
- **THEN** the upcoming-changes query returns an empty collection rather than invented placeholder events

### Requirement: Derived Organization readiness

The system SHALL derive Organization readiness from persisted canonical state: a permanent root exists and the current official hierarchy validates as one connected acyclic tree. It SHALL not require a manual completion action, a minimum unit count, or custom type configuration.

#### Scenario: Root-only organization is ready

- **WHEN** a tenant has an active valid permanent root and no other active units
- **THEN** Organization readiness resolves Ready

#### Scenario: Future-only root is not currently ready

- **WHEN** the permanent root is scheduled but not effective today
- **THEN** Organization readiness does not resolve Ready until the root's effective date and valid current hierarchy exist

### Requirement: Query authorization and tenant isolation

Organization hierarchy, detail, search, history, upcoming-change, type, and readiness queries SHALL fail closed without the resolved tenant and SHALL require Organization.View or Organization.Manage. A caller SHALL not infer another tenant's units, types, history, readiness, or scheduled changes.

#### Scenario: Cross-tenant unit detail

- **WHEN** a caller requests a unit identifier owned by another tenant
- **THEN** the query returns no Organization data and does not disclose the unit's existence through a successful response
