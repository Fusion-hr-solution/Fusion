using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;

public sealed record MyObjectivePlanCampaignDto(
    Guid Id,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    PlanStatus? PlanStatus,
    int ObjectiveCount,
    int TotalWeight);

public sealed record EmployeeObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    ObjectiveAlignmentType? AlignmentType,
    Guid? AlignmentTargetId,
    string? AlignmentTitle,
    int? Weight,
    DateTime? Deadline,
    string? MeasurementMethod,
    string? MeasurementIndicator,
    string? TargetValue,
    string? TargetUnit,
    string? SuccessCriteria,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record EmployeeObjectivePlanDto(
    Guid Id,
    Guid CycleId,
    Guid EmployeeId,
    PlanStatus Status,
    DateTime? SubmittedAt,
    Guid? ApproverEmployeeId,
    string? ApproverName,
    int ObjectiveCount,
    int TotalWeight,
    uint Version,
    IReadOnlyList<EmployeeObjectiveDto> Objectives);

public sealed record EmployeeObjectiveAlignmentOptionDto(
    ObjectiveAlignmentType Type,
    Guid TargetId,
    string Title,
    Guid? StrategicObjectiveId,
    string? StrategicObjectiveTitle);

public sealed record EmployeeObjectivePlanWorkspaceDto(
    string State,
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    int MaxObjectiveCount,
    IReadOnlyList<int> AllowedWeights,
    IReadOnlyList<string> EnabledMeasurementMethods,
    EmployeeObjectivePlanDto? Plan,
    IReadOnlyList<EmployeeObjectiveAlignmentOptionDto> AlignmentOptions);

public sealed record SaveEmployeeObjectiveRequest(
    string Title,
    string? Description,
    ObjectiveAlignmentType? AlignmentType,
    Guid? AlignmentTargetId,
    int? Weight,
    DateTime? Deadline,
    string? MeasurementMethod,
    string? MeasurementIndicator,
    string? TargetValue,
    string? TargetUnit,
    string? SuccessCriteria);

public sealed record SubmitObjectivePlanResponseDto(
    bool Submitted,
    EmployeeObjectivePlanDto Plan,
    IReadOnlyList<ObjectivePlanBlockingReasonDto> BlockingReasons);

public sealed record ObjectivePlanBlockingReasonDto(string Code, string Message, Guid? ObjectiveId);
