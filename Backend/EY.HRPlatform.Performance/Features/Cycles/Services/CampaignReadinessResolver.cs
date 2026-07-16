using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Workforce;

namespace EY.HRPlatform.Performance.Features.Cycles.Services;

/// <summary>
/// Computes live launch readiness for a campaign Draft: resolves the population, resolves each
/// participant's approver (default Core primary manager or an HR override), and classifies
/// outstanding conditions as blocking or informational. Read-only; never mutates state.
/// The launch command reuses the resolved participants to freeze the baseline.
/// </summary>
public interface ICampaignReadinessResolver
{
    Task<CampaignReadinessResult> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken);
}

public sealed record ResolvedReadinessParticipant(
    Guid EmployeeId,
    string FullName,
    string? EmployeeKey,
    string? Email,
    Guid? OrgUnitId,
    string? OrgUnitName,
    string? JobTitle,
    Guid? ManagerId,
    string? ManagerName,
    Guid? ApproverEmployeeId,
    string? ApproverName,
    bool IsApproverOverridden,
    string? ApproverOverrideReason,
    bool ApproverIsActive)
{
    public bool HasApprover => ApproverEmployeeId.HasValue && ApproverEmployeeId.Value != Guid.Empty;
}

public sealed record CampaignReadinessResult(
    bool IsAllActiveBaseline,
    IReadOnlyList<ResolvedReadinessParticipant> Participants,
    IReadOnlyList<CampaignPopulationExclusionDto> Exclusions,
    IReadOnlyList<CampaignReadinessConditionDto> BlockingConditions,
    IReadOnlyList<CampaignReadinessConditionDto> InformationalConditions)
{
    public bool CanLaunch => BlockingConditions.Count == 0;
    public int IncludedCount => Participants.Count;
}

public sealed class CampaignReadinessResolver(
    IPerformancePopulationResolver populationResolver,
    ICoreWorkforceClient workforceClient) : ICampaignReadinessResolver
{
    public const string SeverityBlocking = "Blocking";
    public const string SeverityInformational = "Informational";

    public async Task<CampaignReadinessResult> ResolveAsync(PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var members = await populationResolver.ResolveAsync(cycle, asOf: null, cancellationToken);

        var overridesByEmployee = cycle.ApproverOverrides
            .GroupBy(o => o.ParticipantEmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        var participants = new List<ResolvedReadinessParticipant>(members.Count);
        foreach (var member in members)
        {
            var displayName = string.IsNullOrWhiteSpace(member.DisplayName) ? member.FullName : member.DisplayName;

            if (overridesByEmployee.TryGetValue(member.EmployeeId, out var over))
            {
                participants.Add(new ResolvedReadinessParticipant(
                    member.EmployeeId, displayName, member.StableEmployeeKey, member.WorkEmail,
                    member.OrgUnit?.OrgUnitId, member.OrgUnit?.Name, member.JobTitle,
                    member.Manager?.EmployeeId, member.Manager?.DisplayName,
                    over.ApproverEmployeeId, over.ApproverName, IsApproverOverridden: true, over.Reason,
                    ApproverIsActive: true));
            }
            else
            {
                participants.Add(new ResolvedReadinessParticipant(
                    member.EmployeeId, displayName, member.StableEmployeeKey, member.WorkEmail,
                    member.OrgUnit?.OrgUnitId, member.OrgUnit?.Name, member.JobTitle,
                    member.Manager?.EmployeeId, member.Manager?.DisplayName,
                    member.Manager?.EmployeeId, member.Manager?.DisplayName, IsApproverOverridden: false, null,
                    ApproverIsActive: member.Manager?.IsActive ?? false));
            }
        }

        var exclusions = await ResolveExclusionsAsync(cycle, cancellationToken);

        var blocking = new List<CampaignReadinessConditionDto>();
        var informational = new List<CampaignReadinessConditionDto>();

        if (participants.Count == 0)
        {
            blocking.Add(new CampaignReadinessConditionDto(
                "NoParticipants", SeverityBlocking, "This campaign has no participants.", null));
        }

        foreach (var participant in participants.Where(p => !p.HasApprover))
        {
            blocking.Add(new CampaignReadinessConditionDto(
                "MissingApprover", SeverityBlocking,
                $"{participant.FullName} has no approver.", participant.EmployeeId));
        }

        if (!cycle.StrategicObjectives.Any(objective => objective.IsActive))
        {
            blocking.Add(new CampaignReadinessConditionDto(
                "NoActiveStrategicObjective", SeverityBlocking,
                "This campaign has no active strategic objective.", null));
        }

        // Best-effort, non-blocking hint: a default approver whose Core record is inactive.
        foreach (var participant in participants.Where(p => p.HasApprover && !p.IsApproverOverridden && !p.ApproverIsActive))
        {
            informational.Add(new CampaignReadinessConditionDto(
                "ApproverInactive", SeverityInformational,
                $"{participant.FullName}'s approver {participant.ApproverName} is inactive in Core.",
                participant.EmployeeId));
        }

        return new CampaignReadinessResult(
            IsAllActiveBaseline: !cycle.PopulationRules.Any(rule => rule.RuleType == PopulationRuleType.OrgUnit),
            participants,
            exclusions,
            blocking,
            informational);
    }

    private async Task<IReadOnlyList<CampaignPopulationExclusionDto>> ResolveExclusionsAsync(
        PerformanceCycle cycle,
        CancellationToken cancellationToken)
    {
        var exclusionRules = cycle.PopulationRules
            .Where(rule => rule.RuleType == PopulationRuleType.ExcludeEmployee)
            .ToList();

        if (exclusionRules.Count == 0)
        {
            return [];
        }

        var resolved = await workforceClient.ResolveEmployeesAsync(
            exclusionRules.Select(rule => rule.RefId).Distinct().ToList(),
            cancellationToken);
        var namesById = resolved.ToDictionary(
            employee => employee.EmployeeId,
            employee => string.IsNullOrWhiteSpace(employee.DisplayName) ? employee.FullName : employee.DisplayName);

        return exclusionRules
            .Select(rule => new CampaignPopulationExclusionDto(
                rule.RefId,
                namesById.TryGetValue(rule.RefId, out var name) ? name : null,
                rule.Reason ?? string.Empty))
            .ToList();
    }
}
