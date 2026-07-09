using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Queries;

/// <summary>
/// Resolves a campaign's population rules against live Core data for preview while editing a draft.
/// Reads never write. When no org-unit scope is set, the resolved set is the all-active baseline.
/// </summary>
public sealed record GetCyclePopulationPreviewQuery(Guid CycleId) : IQuery<Result<CyclePopulationPreviewDto>>;

public sealed class GetCyclePopulationPreviewQueryHandler(
    PerformanceDbContext dbContext,
    IPerformancePopulationResolver populationResolver,
    ICoreWorkforceClient workforceClient)
    : IQueryHandler<GetCyclePopulationPreviewQuery, Result<CyclePopulationPreviewDto>>
{
    public async Task<Result<CyclePopulationPreviewDto>> Handle(
        GetCyclePopulationPreviewQuery request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<CyclePopulationPreviewDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var members = await populationResolver.ResolveAsync(cycle, asOf: null, cancellationToken);

        var memberDtos = members
            .Select(member => new CyclePopulationMemberDto(
                member.EmployeeId,
                string.IsNullOrWhiteSpace(member.DisplayName) ? member.FullName : member.DisplayName,
                member.WorkEmail,
                member.JobTitle,
                member.OrgUnit?.OrgUnitId,
                member.OrgUnit?.Name,
                member.Manager?.EmployeeId,
                member.Manager?.DisplayName,
                member.IsActive))
            .ToList();

        var exclusions = await ResolveExclusionsAsync(cycle.PopulationRules, cancellationToken);
        var isAllActiveBaseline = !cycle.PopulationRules.Any(rule => rule.RuleType == PopulationRuleType.OrgUnit);

        return new CyclePopulationPreviewDto(isAllActiveBaseline, memberDtos.Count, memberDtos, exclusions);
    }

    private async Task<IReadOnlyList<CampaignPopulationExclusionDto>> ResolveExclusionsAsync(
        IEnumerable<Domain.Entities.PerformanceCyclePopulationRule> rules,
        CancellationToken cancellationToken)
    {
        var exclusionRules = rules
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
