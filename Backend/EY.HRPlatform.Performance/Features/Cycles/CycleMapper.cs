using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;

namespace EY.HRPlatform.Performance.Features.Cycles;

public static class CycleMapper
{
    public static PerformanceCycleSummaryDto ToSummary(
        PerformanceCycle cycle,
        int participantCount,
        int dueSoonWindowDays,
        DateTime utcNow)
        => new(
            cycle.Id,
            cycle.Name,
            cycle.Slug,
            cycle.ReferenceYear,
            cycle.Type.ToString(),
            cycle.Status.ToString(),
            cycle.PeriodStart,
            cycle.PeriodEnd,
            cycle.ObjectiveSettingDeadline,
            CycleDeadline.Evaluate(cycle, utcNow, dueSoonWindowDays),
            participantCount,
            cycle.LaunchedAt,
            cycle.ClosedAt,
            cycle.CreatedAt,
            cycle.Version);

    public static PerformanceCycleDetailDto ToDetail(
        PerformanceCycle cycle,
        int participantCount,
        int dueSoonWindowDays,
        DateTime utcNow)
        => new(
            cycle.Id,
            cycle.Name,
            cycle.Slug,
            cycle.Description,
            cycle.Purpose,
            cycle.ReferenceYear,
            cycle.OwnerUserId,
            cycle.OwnerName,
            cycle.Type.ToString(),
            cycle.Status.ToString(),
            cycle.PeriodStart,
            cycle.PeriodEnd,
            cycle.ObjectiveSettingDeadline,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.ManagerApprovalDeadline,
            cycle.ExpectedPlanningLockDate,
            CycleDeadline.Evaluate(cycle, utcNow, dueSoonWindowDays),
            cycle.PopulationIncludeInactive,
            participantCount,
            cycle.LaunchedAt,
            cycle.ClosedAt,
            cycle.CreatedAt,
            cycle.UpdatedAt,
            cycle.Version,
            cycle.PopulationRules.Select(ToRuleDto).ToList(),
            cycle.PlanningRulesSnapshot is null
                ? null
                : new CampaignPlanningRulesSnapshotDto(
                    cycle.PlanningRulesSnapshot.MaxObjectiveCount,
                    cycle.PlanningRulesSnapshot.AllowedWeightMenu,
                    cycle.PlanningRulesSnapshot.EnabledMeasurementMethods,
                    cycle.PlanningRulesSnapshot.SourceConfigurationVersionId,
                    cycle.PlanningRulesSnapshot.CapturedAt),
            cycle.StrategicObjectives
                .OrderBy(objective => objective.CreatedAt)
                .Select(ToStrategicObjectiveDto)
                .ToList(),
            ToCompletenessDto(cycle.EvaluateDraftCompleteness()));

    public static PopulationRuleDto ToRuleDto(PerformanceCyclePopulationRule rule)
        => new(rule.RuleType.ToString(), rule.RefId, rule.IncludeDescendants, rule.Reason);

    public static CampaignStrategicObjectiveDto ToStrategicObjectiveDto(CampaignStrategicObjective objective)
        => new(
            objective.Id,
            objective.Title,
            objective.Description,
            objective.ResponsibleFunctionLabel,
            objective.IsActive,
            objective.Version);

    private static CampaignDraftCompletenessDto ToCompletenessDto(CampaignDraftCompleteness completeness)
        => new(completeness.IsComplete, completeness.BlockingReasons);

    public static CycleParticipantDto ToParticipantDto(PerformanceCycleParticipant participant)
        => new(
            participant.Id,
            participant.EmployeeId,
            participant.EmployeeKey,
            participant.FullName,
            participant.Email,
            participant.OrgUnitId,
            participant.OrgUnitName,
            participant.JobTitle,
            participant.ManagerId,
            participant.ManagerName,
            participant.ApproverEmployeeId,
            participant.ApproverName,
            participant.IsApproverOverridden,
            participant.ApproverOverrideReason,
            participant.SnapshotAt);

    public static CycleAuditEventDto ToAuditDto(PerformanceCycleAuditEvent auditEvent)
        => new(
            auditEvent.Id,
            auditEvent.Action.ToString(),
            auditEvent.ActorUserId,
            auditEvent.ActorName,
            auditEvent.OccurredAt,
            auditEvent.Details);
}
