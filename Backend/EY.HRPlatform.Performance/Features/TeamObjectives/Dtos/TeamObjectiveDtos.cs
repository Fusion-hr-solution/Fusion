namespace EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;

public sealed record TeamObjectiveDto(
    Guid Id,
    Guid CycleId,
    Guid StrategicObjectiveId,
    string StrategicObjectiveTitle,
    Guid OwnerManagerEmployeeId,
    string OwnerManagerName,
    string Title,
    string SuccessCriteria,
    string MeasurementMethod,
    string? Description,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

/// <summary>A launched campaign where the signed-in user is the frozen approver of at least one participant.</summary>
public sealed record MyTeamObjectiveCampaignDto(
    Guid Id,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    int ScopeParticipantCount,
    int MyTeamObjectiveCount);

public sealed record TeamObjectiveScopeParticipantDto(
    Guid EmployeeId,
    string FullName,
    string? JobTitle,
    string? OrgUnitName);

/// <summary>The manager's frozen campaign scope: the participants they are the resolved approver for.</summary>
public sealed record TeamObjectiveScopeDto(
    int ParticipantCount,
    IReadOnlyList<string> OrgUnitNames,
    IReadOnlyList<TeamObjectiveScopeParticipantDto> Participants);

public sealed record TeamObjectiveStrategicObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel);

public sealed record TeamObjectiveWorkspaceDto(
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    IReadOnlyList<string> EnabledMeasurementMethods,
    IReadOnlyList<TeamObjectiveStrategicObjectiveDto> StrategicObjectives,
    TeamObjectiveScopeDto MyScope,
    IReadOnlyList<TeamObjectiveDto> MyTeamObjectives);

// ----- Cascade coverage (read-only, computed live) -----

public sealed record CascadeCoverageCampaignDto(
    Guid Id,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? LaunchedAt);

public sealed record CoverageStrategicObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    string? ResponsibleFunctionLabel,
    int TeamObjectiveCount);

public sealed record CoverageManagerDto(
    Guid EmployeeId,
    string Name,
    int ScopeSize,
    int TeamObjectiveCount);

public sealed record CascadeCoverageDto(
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? LaunchedAt,
    int ActiveStrategicObjectiveCount,
    int CoveredStrategicObjectiveCount,
    int ManagerCount,
    int ManagersWithTeamObjectivesCount,
    int TeamObjectiveCount,
    IReadOnlyList<CoverageStrategicObjectiveDto> StrategicObjectives,
    IReadOnlyList<CoverageManagerDto> Managers,
    IReadOnlyList<TeamObjectiveDto> TeamObjectives);

// ----- Request payloads -----

public sealed record UpsertTeamObjectiveRequest(
    Guid StrategicObjectiveId,
    string Title,
    string SuccessCriteria,
    string MeasurementMethod,
    string? Description);
