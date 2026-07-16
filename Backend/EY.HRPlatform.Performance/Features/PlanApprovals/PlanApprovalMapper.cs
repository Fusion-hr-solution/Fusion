using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;

namespace EY.HRPlatform.Performance.Features.PlanApprovals;

internal static class PlanApprovalMapper
{
    public static PlanApprovalReviewDto ToReviewDto(
        EmployeeObjectivePlan plan,
        PerformanceCycleParticipant participant,
        bool isSelfApprovalDataIssue)
    {
        var reviewHistory = plan.ReviewEvents
            .OrderBy(item => item.OccurredAt)
            .Select(item => new PlanReviewHistoryEventDto(
                item.Id,
                item.Type,
                item.ActorEmployeeId,
                item.ActorName,
                item.Comment,
                item.ReferencedObjectiveIds,
                item.OccurredAt))
            .ToList();

        return new PlanApprovalReviewDto(
            plan.Id,
            plan.CycleId,
            plan.EmployeeId,
            participant.FullName,
            participant.JobTitle,
            participant.OrgUnitName,
            plan.Status,
            ToReviewState(plan.Status),
            plan.Objectives.Count,
            plan.Objectives.Sum(objective => objective.Weight ?? 0),
            plan.SubmittedAt,
            plan.ApprovedAt,
            plan.ApprovingManagerEmployeeId,
            plan.ApprovingManagerName,
            reviewHistory.Count == 0 ? null : reviewHistory[^1].OccurredAt,
            plan.LastChangeRequestComment,
            isSelfApprovalDataIssue,
            isSelfApprovalDataIssue ? "The frozen approver is the same person as the employee. This plan cannot be approved until the baseline is corrected." : null,
            plan.Version,
            plan.Objectives
                .OrderBy(objective => objective.CreatedAt)
                .Select(ToObjectiveDto)
                .ToList(),
            reviewHistory);
    }

    public static string ToReviewState(PlanStatus status)
        => status switch
        {
            PlanStatus.Submitted => "waiting-for-review",
            PlanStatus.ChangesRequested => "changes-requested",
            PlanStatus.Approved => "approved",
            _ => "not-ready"
        };

    private static EmployeeObjectiveDto ToObjectiveDto(EmployeeObjective objective)
        => new(
            objective.Id,
            objective.Title,
            objective.Description,
            objective.AlignmentType,
            objective.AlignmentTargetId,
            objective.AlignmentTitle,
            objective.Weight,
            objective.Deadline,
            objective.MeasurementMethod,
            objective.MeasurementIndicator,
            objective.TargetValue,
            objective.TargetUnit,
            objective.SuccessCriteria,
            objective.CreatedAt,
            objective.UpdatedAt);
}
