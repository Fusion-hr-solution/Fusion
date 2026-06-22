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
            cycle.Type.ToString(),
            cycle.Status.ToString(),
            cycle.PeriodStart,
            cycle.PeriodEnd,
            cycle.ObjectiveSettingDeadline,
            CycleDeadline.Evaluate(cycle, utcNow, dueSoonWindowDays),
            participantCount,
            cycle.PublishedAt,
            cycle.ActivatedAt,
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
            cycle.Description,
            cycle.Type.ToString(),
            cycle.Status.ToString(),
            cycle.PeriodStart,
            cycle.PeriodEnd,
            cycle.ObjectiveSettingDeadline,
            CycleDeadline.Evaluate(cycle, utcNow, dueSoonWindowDays),
            cycle.PopulationIncludeInactive,
            participantCount,
            cycle.PublishedAt,
            cycle.ActivatedAt,
            cycle.ClosedAt,
            cycle.CreatedAt,
            cycle.UpdatedAt,
            cycle.Version,
            cycle.PopulationRules.Select(ToRuleDto).ToList(),
            new CampaignGovernanceDto(
                cycle.FrozenRetentionPolicyVersionId ?? cycle.RetentionPolicyVersionId,
                cycle.FrozenRequireTeamObjectiveSuperiorApproval ?? cycle.RequireTeamObjectiveSuperiorApproval,
                cycle.FrozenMinimumAnonymousFeedbackResponses ?? cycle.MinimumAnonymousFeedbackResponses,
                (cycle.FrozenFeedbackVisibility ?? cycle.FeedbackVisibility).ToString(),
                cycle.ExceptionOwners.OrderBy(x => x.Priority).Select(x => x.EmployeeId).ToList(),
                cycle.GovernanceFrozenAt is not null,
                cycle.GovernanceFrozenAt));

    public static PopulationRuleDto ToRuleDto(PerformanceCyclePopulationRule rule)
        => new(rule.RuleType.ToString(), rule.RefId, rule.IncludeDescendants);

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
