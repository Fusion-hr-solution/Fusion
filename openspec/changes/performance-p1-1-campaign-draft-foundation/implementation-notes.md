## Scope Disposition

### Lean Draft contract

This slice implements only the campaign Draft foundation:

- identity: campaign name, reference year, purpose, owner as the creating user;
- schedule: planning opening, employee submission, manager approval, expected planning lock;
- frozen planning rules snapshot: maximum objective count, allowed weight menu, enabled measurement methods;
- campaign-scoped strategic objectives: title, description, responsible function label, active state;
- lifecycle: `Draft` only for the create/edit surface.

No population, readiness, activation, team objectives, employee plans, approvals, reminders, or lock behavior is introduced in this slice.

### Campaign aggregate disposition

`PerformanceCycle` remains the single campaign aggregate. No parallel campaign aggregate was introduced.

Refit now:

- `Backend/EY.HRPlatform.Performance/Domain/Entities/PerformanceCycle.cs` adds reference year, purpose, owner, four-date planning schedule, frozen rules snapshot, campaign strategic objectives, and Draft completeness.
- `Backend/EY.HRPlatform.Performance/Features/Cycles/Commands/CreateCycle.cs` now creates the lean Draft and captures the tenant objective-planning configuration at creation.
- `Backend/EY.HRPlatform.Performance/Features/Cycles/Commands/UpdateCycle.cs` edits Draft identity and schedule with optimistic concurrency.
- `Backend/EY.HRPlatform.Performance/Features/Cycles/Dtos/PerformanceCycleDtos.cs` exposes campaign Draft fields while preserving existing cycle DTO compatibility.

Deferred but still wired:

- population rules, participant snapshots, readiness, activation, workforce delta, governance, feedback, exceptions, and responsibility curation remain in existing `Features/Cycles`, `Features/Feedback`, `Features/Exceptions`, and `Features/CollectiveObjectives` paths for P1.2+.

### Generic strategy disposition

`StrategicObjective` / `StrategicPeriod` is superseded for P1 campaign strategy. It was not extended with new P1 UI, navigation, or API behavior.

Left untouched:

- `Backend/EY.HRPlatform.Performance/Domain/Entities/StrategicObjective.cs`
- `Backend/EY.HRPlatform.Performance/Domain/Entities/StrategicPeriod.cs`
- `Backend/EY.HRPlatform.Performance/Controllers/StrategicObjectivesController.cs`
- `Backend/EY.HRPlatform.Performance/Features/Strategic/*`
- existing collective objective consumers under `Backend/EY.HRPlatform.Performance/Features/CollectiveObjectives/*`

Removal and collective/team-objective repointing are deferred to P1.3.

### Authorization disposition

No permission catalog entries were added. Draft campaign writes and campaign strategic-objective management reuse `CycleManage`; reads reuse `CycleView` or manage through `PerformanceAccessPolicyService` and frontend helpers in `@repo/auth`.
