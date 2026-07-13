using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives;

internal static class EmployeeObjectivePlanMapper
{
    public static EmployeeObjectivePlanDto ToPlanDto(EmployeeObjectivePlan plan)
        => new(
            plan.Id,
            plan.CycleId,
            plan.EmployeeId,
            plan.Status,
            plan.SubmittedAt,
            plan.ApproverEmployeeId,
            plan.ApproverName,
            plan.ApprovedAt,
            plan.ApprovingManagerEmployeeId,
            plan.ApprovingManagerName,
            plan.LastChangeRequestComment,
            plan.Objectives.Count,
            plan.Objectives.Sum(objective => objective.Weight ?? 0),
            plan.Version,
            plan.Objectives
                .OrderBy(objective => objective.CreatedAt)
                .Select(ToObjectiveDto)
                .ToList(),
            plan.ReviewEvents
                .OrderBy(item => item.OccurredAt)
                .Select(item => new EmployeeObjectivePlanReviewHistoryEventDto(
                    item.Id,
                    item.Type,
                    item.ActorEmployeeId,
                    item.ActorName,
                    item.Comment,
                    item.ReferencedObjectiveIds,
                    item.OccurredAt))
                .ToList());

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
