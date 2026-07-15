using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;

namespace EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;

public sealed record PlanApprovalCampaignDto(
    Guid Id,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    DateTime? PlanningLockedAt,
    string? PlanningLockedByName,
    int WaitingForReviewCount,
    int ChangesRequestedCount,
    int ApprovedCount,
    int DataIssueCount);

public sealed record PlanApprovalWorkspaceDto(
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? PlanningOpeningDate,
    DateTime? EmployeeSubmissionDeadline,
    DateTime? ManagerApprovalDeadline,
    DateTime? LaunchedAt,
    DateTime? PlanningLockedAt,
    string? PlanningLockedByName,
    int WaitingForReviewCount,
    int ChangesRequestedCount,
    int ApprovedCount,
    int DataIssueCount,
    IReadOnlyList<PlanApprovalReviewDto> Plans);

public sealed record PlanApprovalReviewDto(
    Guid PlanId,
    Guid CycleId,
    Guid EmployeeId,
    string EmployeeName,
    string? JobTitle,
    string? OrgUnitName,
    PlanStatus Status,
    string ReviewState,
    int ObjectiveCount,
    int TotalWeight,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    Guid? ApprovingManagerEmployeeId,
    string? ApprovingManagerName,
    DateTime? LastReviewEventAt,
    string? LastChangeRequestComment,
    bool IsSelfApprovalDataIssue,
    string? DataIssueMessage,
    uint Version,
    IReadOnlyList<EmployeeObjectiveDto> Objectives,
    IReadOnlyList<PlanReviewHistoryEventDto> ReviewHistory);

public sealed record PlanReviewHistoryEventDto(
    Guid Id,
    ReviewEventType Type,
    Guid ActorEmployeeId,
    string ActorName,
    string? Comment,
    IReadOnlyList<Guid> ReferencedObjectiveIds,
    DateTime OccurredAt);

public sealed record RequestObjectivePlanChangesRequest(
    string Comment,
    IReadOnlyList<Guid>? ReferencedObjectiveIds = null);
