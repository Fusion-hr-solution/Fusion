## ADDED Requirements

### Requirement: Concurrent progress writes return a retryable conflict, never a server error

Progress recording serializes per plan through the plan's optimistic-concurrency version. When two progress writes on the same plan race and one loses the version check, the losing request SHALL return a typed, retryable conflict result carrying the current plan version — it MUST NOT surface as an unhandled server error (HTTP 500). The employee's entered values SHALL be preserved so the update can be retried against the refreshed state.

#### Scenario: A losing concurrent write returns a typed conflict
- **WHEN** two record-progress requests for the same plan are submitted with the same expected version and the first commits
- **THEN** the second request returns a typed retryable conflict result with the refreshed plan version, and no `DbUpdateConcurrencyException` escapes as a 500

#### Scenario: The employee can retry after a conflict without losing input
- **WHEN** the record-progress dialog receives a conflict result
- **THEN** the entered percent, comment, actual result, and regression reason are preserved and the employee is invited to retry against the refreshed workspace

### Requirement: A progress update is never recorded with an unknown actor

Every progress row is an immutable audit record and SHALL carry a resolvable actor. If the acting user's identity cannot be resolved, the write SHALL fail closed (rejected as unauthorized) rather than persist a row with an empty or placeholder actor id.

#### Scenario: A request without a resolvable user id is rejected
- **WHEN** a record-progress request is processed but the current user's id cannot be resolved
- **THEN** the request is rejected and no progress row is written

#### Scenario: A recorded update attributes a real actor
- **WHEN** a progress update is successfully recorded
- **THEN** the persisted row carries the acting user's non-empty id and display name

### Requirement: The progress surface uses product language without explanatory captions

Copy on the progress record surface SHALL convey state through structure, values, and labels — not through explanatory caption or hint sentences. Field-level optionality MAY be marked, but standalone sentences that merely describe what the UI does SHALL NOT be present. Copy SHALL NOT reference capabilities that are not yet built.

#### Scenario: No explainer captions on the progress workspace
- **WHEN** the post-lock progress workspace and record dialog render
- **THEN** no standalone caption sentence merely explains the meter, the weighting, the actual-result field, or the evidence field

#### Scenario: No forward-reference to unbuilt capabilities
- **WHEN** any progress copy renders
- **THEN** it does not direct the user to check-ins or other capabilities that are not present in the product
