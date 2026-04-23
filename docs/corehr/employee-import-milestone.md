# CoreHR Employee Import Milestone

Last updated: 2026-04-23.
Milestone: Employee Foundation & Import.
Current branch slice: PR 1 / employee import foundation.
Branch status: ready to open PR and pending review.

## What This Milestone Is For

CoreHR should let a tenant HR admin complete setup, move into Employees, import workforce data through an official CSV template, validate it against live tenant structure, apply the import safely, and only then let downstream read experiences consume that workforce data.

This milestone is the bridge from setup and live organization foundation into day-two employee operations.

## What This Branch Adds

- Adds an HR-admin-only employee import API surface under `api/corehr/employees/import`.
- Adds the official employee import template contract with exact headers and stable business keys.
- Persists employee import sessions with preview-ready state and expiration.
- Stores uploaded source rows and normalized preview rows for a saved review flow.
- Adds the tenant Employees entry-point CTA for `Import employees`.
- Adds the frontend import page with template download, CSV upload, saved-session reload, uploaded rows, normalized preview, and collapsed field reference.
- Keeps the import page operational and sparse: no mapping UI, no separate structure-explainer card, and no apply button yet.
- Covers the slice with focused backend and frontend tests.

## Locked MVP Contract

### Audience and access

- Primary operator: tenant `HRAdmin`.
- Entry flow: setup complete -> Employees -> Import employees.
- Non-audience for this workflow: ordinary employees, managers, and platform-admin-only operations.

### Data contract

- Official template only.
- Exact header match and exact order.
- Stable business keys, not mapping UI.
- Structural reference: `orgUnitCode`.
- Reporting reference: `managerEmail`.
- Stable employee identity for MVP: work `email`.
- `department` is not part of the employee import contract.

### UX contract

- The import page is an admin workflow, not a structure explainer.
- Top-of-page responsibilities stay narrow: purpose, three-step flow, and the two primary actions.
- Field reference stays secondary and collapsed.
- Preview exists to support review before validation.
- Correction model is fix the source file and re-upload, not in-app spreadsheet editing.

## Remaining Work

### PR 2: validation against live tenant structure

- Resolve `orgUnitCode` against active org units in the current tenant.
- Resolve `managerEmail` in tenant scope.
- Validate required fields and data formats.
- Detect duplicates and tenant identity conflicts.
- Return row-level issues and a usable validation summary.
- Keep the operator in a clear validate, fix, and re-upload loop.

### PR 3: apply, results, and audit

- Add the explicit import execution step after successful validation.
- Support clear create, update, skip, and error semantics.
- Return a results summary that explains what happened.
- Add import audit and history surfaces suitable for day-two operations.
- Add the necessary guardrails around reruns, expiration, and operator confidence.

## Remaining Work By Angle

### Product

- Finish the full employee import lifecycle so import becomes a repeatable workforce operation, not just a preview tool.
- Keep manual employee management behind import in priority unless a narrow unblocker appears.

### UX

- Validation must read as the proof step for structure fidelity.
- Apply must read as a deliberate administrative action with clear consequences.
- Results must make bulk outcomes easy to scan without turning into a spreadsheet editor.

### Data integrity

- Enforce live-structure truth through validation, not upload-page copy.
- Keep `orgUnitCode` and `managerEmail` tenant-scoped and trustworthy.
- Preserve stable identity rules around employee email and duplicates.

### Access and safety

- Keep the import workflow HR-admin-owned end to end.
- Finish the broader employee and org-unit write-role alignment still noted in CoreHR.
- Ensure import audit is good enough for operational accountability.

### Technical

- Carry the current session model forward into validation and apply without creating a second competing import contract.
- Keep frontend code feature-local unless reuse becomes real.
- Maintain focused tests around contract, authorization, validation, and execution semantics.

## Higher-Level Follow-Up After This Milestone

- Employee management productization beyond roster read-only views.
- Employee-to-org-unit linkage completion across manual and non-import write flows.
- Reporting-line integrity workflows.
- Org chart and structure-aware people experiences built on top of imported and validated workforce data.