## 1. Canonical read-contract correction

- [x] 1.1 Add typed Organization business-event and before/after context DTOs, and enrich readiness with permanent-root initialization metadata without changing canonical persistence.
- [x] 1.2 Project History and Upcoming Changes from canonical operations/states in bulk, with accurate unit name/code mapping, structured Created/Renamed/Type changed/Moved/Inactivated semantics, and Correction excluded from business History.

## 2. Contract propagation and regression coverage

- [x] 2.1 Update the canonical Organization controller/service contracts and `@repo/api` DTOs/paths/query keys only as needed for the corrected reads; do not add Change 2 UI hooks or components.
- [x] 2.2 Add focused CoreHR tests for structured History/Upcoming semantics, before/after context, unit name/code mapping, historical Correction behavior, root initialization states, authorization, and tenant isolation.
- [x] 2.3 Add or update `@repo/api` serialization/contract tests for the corrected canonical DTOs.

## 3. Verification and archive

- [x] 3.1 Run relevant CoreHR tests/build, `@repo/api` tests/type-check/lint, EF pending-model verification if applicable, and strict OpenSpec validation; repair only defects within this corrective scope.
- [x] 3.2 Confirm the Change 2 conformance gate is satisfied, mark every task complete, and archive this corrective change with canonical spec updates.
