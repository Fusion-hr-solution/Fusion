# performance-campaign-population-launch Specification

## Purpose
TBD - created by archiving change performance-p1-2-objective-planning-population-launch. Update Purpose after archive.
## Requirements
### Requirement: HR defines the objective-planning population scope

The system SHALL let an authorized HR user define which employees participate in a campaign Draft's objective-planning stage using an all-active baseline, optional org-unit scopes (each optionally including descendant org units), and manual exclusions that each require a reason. The scope SHALL describe intent and SHALL be resolved live against Core workforce truth; resolving the scope SHALL NOT mutate any campaign, participant, or Core data.

#### Scenario: All-active baseline when no scope is set

- **WHEN** an authorized HR user has defined no org-unit scope on the campaign Draft
- **THEN** the resolved population is every active employee in the acting tenant
- **AND** no participant records are created before launch

#### Scenario: Org-unit scope with descendants

- **WHEN** an authorized HR user adds an org-unit scope with descendants included
- **THEN** the resolved population includes active employees of that org unit and its descendant org units
- **AND** the resolution reflects current Core workforce data

#### Scenario: Exclusion requires a reason

- **WHEN** an authorized HR user excludes an employee from the population without providing a reason
- **THEN** the system rejects the exclusion with a validation reason naming the missing reason
- **AND** does not change the population
- **AND** preserves the other entered values

#### Scenario: Excluded employee is removed from the resolved population

- **GIVEN** an employee resolved into the population by an org-unit scope
- **WHEN** an authorized HR user excludes that employee with a reason
- **THEN** the resolved population no longer includes that employee
- **AND** the exclusion and its reason are retained on the Draft for readiness review

#### Scenario: Population preview never writes

- **WHEN** an authorized HR user previews the resolved population
- **THEN** the system returns the live resolved members without creating, freezing, or mutating any participant baseline

### Requirement: Default approver baseline resolves from the Core primary manager

The system SHALL resolve, for each included participant, a default approver equal to that participant's Core primary manager at readiness and launch time. A participant with no resolvable default approver SHALL be treated as a blocking readiness condition until an approver is overridden or the participant is excluded.

#### Scenario: Default approver is the primary manager

- **WHEN** the population is resolved for a participant who has a Core primary manager
- **THEN** the participant's default approver is that primary manager

#### Scenario: Participant without a manager is a blocking condition

- **GIVEN** an included participant with no Core primary manager and no approver override
- **WHEN** launch readiness is evaluated
- **THEN** the system reports that participant as a blocking missing-approver condition

### Requirement: HR overrides a participant's approver

The system SHALL let an authorized HR user override the approver for an individual included participant by selecting an active Core employee in the acting tenant as that participant's campaign approver, and providing a reason. Overriding an approver SHALL NOT require configuring approval chains, multi-level approvals, or matrix-manager relationships. The override SHALL be stored on the campaign Draft and SHALL clear the missing-approver condition for that participant.

#### Scenario: Override sets a different approver

- **WHEN** an authorized HR user overrides a participant's approver to another active Core employee in the tenant with a reason
- **THEN** the system records the overridden approver and reason for that participant
- **AND** the participant's resolved approver becomes the overridden approver

#### Scenario: Override clears the missing-approver condition

- **GIVEN** a participant flagged as a blocking missing-approver condition
- **WHEN** an authorized HR user overrides that participant's approver to a valid Core employee
- **THEN** the participant is no longer a blocking missing-approver condition

#### Scenario: Override target must be a valid tenant employee

- **WHEN** an authorized HR user attempts to override an approver to an employee that is not an active Core employee in the acting tenant
- **THEN** the system rejects the override with a validation reason
- **AND** does not change the approver

### Requirement: HR reviews launch readiness as a live computed view

The system SHALL expose a launch readiness review that is computed live and is NOT a persisted campaign state. The review SHALL list the included participants with their resolved approver, the excluded employees with reasons, and SHALL classify outstanding conditions as blocking (no included participants, any participant without a resolvable approver, no active strategic objective) or informational (for example, participants whose Core context changed since the scope was set, or — when Identity/access data is readily available — a resolved approver with an access or account issue). Approver access/account issues SHALL be informational only and SHALL NOT block launch, and the review SHALL NOT trigger any access provisioning. Reads SHALL NOT mutate state.

#### Scenario: Readiness lists participants, approvers, and exclusions

- **WHEN** an authorized user opens launch readiness for a campaign Draft with a resolved population
- **THEN** the system returns the included participants with each participant's resolved approver
- **AND** the excluded employees with their reasons

#### Scenario: Blocking conditions are reported distinctly from informational ones

- **GIVEN** a campaign Draft whose population includes a participant with no resolvable approver
- **WHEN** launch readiness is evaluated
- **THEN** the system reports a blocking condition for the missing approver
- **AND** does not report it as merely informational

#### Scenario: Empty population blocks launch

- **WHEN** launch readiness is evaluated for a campaign Draft whose resolved population is empty
- **THEN** the system reports a blocking condition that the campaign has no participants

#### Scenario: Approver access or account issue is informational, not blocking

- **GIVEN** Identity/access data is readily available and a resolved approver has an access or account issue
- **WHEN** launch readiness is evaluated
- **THEN** the system reports the approver's access/account issue as an informational condition
- **AND** does not block launch on that basis
- **AND** does not trigger any access provisioning

### Requirement: Launch freezes the participant and approver baseline

The system SHALL launch a campaign Draft in a single `Draft → Launched` transition that re-resolves the population against Core, freezes an immutable participant baseline (each participant's Core identity, org/team context, and resolved approver identity, including whether the approver was overridden and any override reason), and marks the campaign as launched. The frozen baseline SHALL NOT change when Core data later changes. Launch SHALL be refused while any blocking readiness condition holds, and a launched campaign SHALL NOT be launched again.

#### Scenario: Launch creates an immutable participant and approver baseline

- **GIVEN** a complete campaign Draft whose readiness has no blocking conditions
- **WHEN** an authorized user launches the campaign
- **THEN** the system creates one frozen participant record per included employee capturing identity, org/team context, and resolved approver
- **AND** transitions the campaign to Launched

#### Scenario: Frozen baseline is unaffected by later Core changes

- **GIVEN** a launched campaign with a frozen participant and approver baseline
- **WHEN** Core later changes an included employee's manager, org unit, or status
- **THEN** the campaign's frozen baseline continues to show the values captured at launch

#### Scenario: Launch is refused while a blocking condition holds

- **GIVEN** a campaign Draft with a participant missing a resolvable approver
- **WHEN** an authorized user attempts to launch
- **THEN** the system refuses the launch with the blocking reason
- **AND** does not freeze any baseline or change the campaign status

#### Scenario: A launched campaign cannot be relaunched

- **GIVEN** a campaign already in Launched status
- **WHEN** a user attempts to launch it again
- **THEN** the system rejects the operation and does not alter the existing baseline

### Requirement: Launch activates orchestration without opening employee objective entry

The system SHALL treat launch as making the campaign active for planning orchestration only. Launch SHALL be permitted even when the planning opening date is in the future, and SHALL NOT itself open employee objective entry; the campaign SHALL record that employee objective entry opens according to the planning schedule's opening date.

#### Scenario: HR launches before the planning opening date

- **GIVEN** a complete, readiness-clear campaign Draft whose planning opening date is in the future
- **WHEN** an authorized user launches the campaign
- **THEN** the system launches the campaign successfully
- **AND** records that employee objective entry opens on the planning opening date

#### Scenario: Launch does not open employee objective entry

- **WHEN** a campaign is launched
- **THEN** the campaign is active for planning orchestration
- **AND** employee objective entry is not opened by the launch itself

### Requirement: A launched campaign's setup is read-only

The system SHALL make a launched campaign's identity, planning schedule, planning-rules snapshot, strategic objectives, and population read-only; edits that are permitted only in Draft SHALL be rejected once the campaign is Launched.

#### Scenario: Draft edits are rejected after launch

- **GIVEN** a campaign in Launched status
- **WHEN** a user attempts to change its identity, schedule, strategic objectives, or population
- **THEN** the system rejects the change because the campaign is no longer a Draft
- **AND** does not mutate the launched campaign

### Requirement: Population and launch surfaces present a truthful resolved state

The system SHALL present the population and readiness surfaces so that the resolved state is explicit and never ambiguous. When no org-unit scope is selected, the surface SHALL explicitly show that all active employees participate rather than appearing empty or unset. The launch confirmation SHALL show the resolved participant count that will be frozen. The readiness surface SHALL present an optimistic state — surfacing what remains to resolve without becoming a blocker-management console.

#### Scenario: All-active baseline is shown explicitly

- **WHEN** a user views population for a campaign Draft with no org-unit scope selected
- **THEN** the surface explicitly indicates that all active employees participate
- **AND** does not present an empty or unset population

#### Scenario: Launch confirmation shows the resolved participant count

- **WHEN** a user opens the launch confirmation for a readiness-clear campaign Draft
- **THEN** the confirmation shows the resolved participant count that will be frozen at launch

#### Scenario: Readiness is presented optimistically

- **WHEN** a user views launch readiness with no blocking conditions
- **THEN** the surface presents the campaign as ready to launch
- **AND** surfaces informational conditions without foregrounding them as blockers

### Requirement: Population and launch are tenant-isolated and authorized deny-by-default

The system SHALL scope all population, approver-override, readiness, and launch operations to the acting tenant and SHALL deny by default. Defining population scope and overriding approvers SHALL require the tenant-scoped campaign-management permission; launching SHALL require the tenant-scoped campaign-operate (publish) permission; reading population preview and readiness SHALL require the campaign-view (or management) permission.

#### Scenario: Unpermitted user cannot define population or override approvers

- **WHEN** a signed-in user without campaign-management permission attempts to set population scope or override an approver
- **THEN** the system denies the operation and does not change any data

#### Scenario: Launch requires the operate permission

- **WHEN** a signed-in user without the campaign-operate (publish) permission attempts to launch a campaign
- **THEN** the system denies the launch and does not freeze any baseline

#### Scenario: Cross-tenant population or launch is denied

- **WHEN** a user attempts to set population, override an approver, read readiness, or launch on a campaign that belongs to a different tenant
- **THEN** the system does not return or mutate that campaign and responds as not found for that tenant

### Requirement: Population and launch operations are audited

The system SHALL record audit facts for setting the population scope, overriding an approver, and launching a campaign, capturing the acting user, the tenant, the campaign, and what changed.

#### Scenario: Launch writes an audit fact

- **WHEN** an authorized user launches a campaign
- **THEN** the system records an audit fact identifying the actor, tenant, campaign, and the launch with the frozen participant count

#### Scenario: Approver override writes an audit fact

- **WHEN** an authorized user overrides a participant's approver
- **THEN** the system records an audit fact identifying the actor, the participant, the new approver, and the reason

