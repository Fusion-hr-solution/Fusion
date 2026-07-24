using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Skills.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Skills.Queries;

/// <summary>
/// Pure read of the full skills configuration workspace: categories, skills, proficiency scales,
/// expectation sets. Tenant defaults are provisioned only via the explicit provision command.
/// </summary>
public sealed record GetSkillsConfigurationWorkspaceQuery(ClaimsPrincipal Actor)
    : IQuery<Result<SkillsConfigurationWorkspaceDto>>;

/// <summary>
/// Round-facing read of active expectation sets (with their proficiency scale and items),
/// exposed under the evaluation configuration permission so a round draft can select a set.
/// </summary>
public sealed record ListActiveExpectationSetsForRoundQuery(ClaimsPrincipal Actor)
    : IQuery<Result<IReadOnlyList<SkillExpectationSetDto>>>;

public sealed class GetSkillsConfigurationWorkspaceQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<GetSkillsConfigurationWorkspaceQuery, Result<SkillsConfigurationWorkspaceDto>>
{
    public async Task<Result<SkillsConfigurationWorkspaceDto>> Handle(
        GetSkillsConfigurationWorkspaceQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageSkills(query.Actor))
            return SkillsConfigurationErrors.Forbidden<SkillsConfigurationWorkspaceDto>();

        var categories = await db.SkillCategories
            .AsNoTracking()
            .OrderBy(category => category.Status)
            .ThenBy(category => category.Name)
            .ToListAsync(cancellationToken);
        var skills = await db.Skills
            .AsNoTracking()
            .OrderBy(skill => skill.Status)
            .ThenBy(skill => skill.Name)
            .ToListAsync(cancellationToken);
        var scales = await db.ProficiencyScales
            .AsNoTracking()
            .Include(scale => scale.Levels)
            .OrderBy(scale => scale.Status)
            .ThenBy(scale => scale.Name)
            .ToListAsync(cancellationToken);
        var sets = await db.SkillExpectationSets
            .AsNoTracking()
            .Include(set => set.Items)
            .OrderBy(set => set.Status)
            .ThenBy(set => set.Name)
            .ToListAsync(cancellationToken);

        var categoryNames = categories.ToDictionary(category => category.Id, category => category.Name);
        var activeSkillCounts = skills
            .Where(skill => skill.Status == SkillLifecycleStatus.Active)
            .GroupBy(skill => skill.SkillCategoryId)
            .ToDictionary(group => group.Key, group => group.Count());
        var skillLookup = skills.ToDictionary(
            skill => skill.Id,
            skill => (skill.Name, CategoryName: categoryNames.GetValueOrDefault(skill.SkillCategoryId, string.Empty)));
        var scalesById = scales.ToDictionary(scale => scale.Id);

        var categoryDtos = categories
            .Select(category => SkillsConfigurationMapper.ToDto(
                category, activeSkillCounts.GetValueOrDefault(category.Id, 0)))
            .ToArray();
        var skillDtos = skills.Select(skill => SkillsConfigurationMapper.ToDto(skill, categoryNames)).ToArray();
        var scaleDtos = scales.Select(SkillsConfigurationMapper.ToDto).ToArray();
        var setDtos = sets.Select(set => SkillsConfigurationMapper.ToDto(
            set,
            scalesById.TryGetValue(set.ProficiencyScaleId, out var scale) ? scale.Name : string.Empty,
            skillLookup,
            LevelLabels(scalesById, set.ProficiencyScaleId))).ToArray();

        return new SkillsConfigurationWorkspaceDto(categoryDtos, skillDtos, scaleDtos, setDtos);
    }

    private static IReadOnlyDictionary<int, string> LevelLabels(
        IReadOnlyDictionary<Guid, ProficiencyScale> scalesById, Guid scaleId) =>
        scalesById.TryGetValue(scaleId, out var scale)
            ? scale.Levels.ToDictionary(level => level.Ordinal, level => level.Label)
            : new Dictionary<int, string>();
}

public sealed class ListActiveExpectationSetsForRoundQueryHandler(
    PerformanceDbContext db,
    IPerformanceAccessPolicyService access)
    : IQueryHandler<ListActiveExpectationSetsForRoundQuery, Result<IReadOnlyList<SkillExpectationSetDto>>>
{
    public async Task<Result<IReadOnlyList<SkillExpectationSetDto>>> Handle(
        ListActiveExpectationSetsForRoundQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(query.Actor))
            return EvaluationForbidden();

        var sets = await db.SkillExpectationSets
            .AsNoTracking()
            .Include(set => set.Items)
            .Where(set => set.Status == EvaluationConfigStatus.Active)
            .OrderBy(set => set.Name)
            .ToListAsync(cancellationToken);
        if (sets.Count == 0)
            return Array.Empty<SkillExpectationSetDto>();

        var scaleIds = sets.Select(set => set.ProficiencyScaleId).Distinct().ToArray();
        var scales = await db.ProficiencyScales
            .AsNoTracking()
            .Include(scale => scale.Levels)
            .Where(scale => scaleIds.Contains(scale.Id))
            .ToDictionaryAsync(scale => scale.Id, cancellationToken);
        var skillIds = sets.SelectMany(set => set.Items.Select(item => item.SkillId)).Distinct().ToArray();
        var skillLookup = await SkillsConfigurationQuerySupport.BuildSkillLookupAsync(db, skillIds, cancellationToken);

        return sets
            .Select(set => SkillsConfigurationMapper.ToDto(
                set,
                scales.TryGetValue(set.ProficiencyScaleId, out var scale) ? scale.Name : string.Empty,
                skillLookup,
                scales.TryGetValue(set.ProficiencyScaleId, out var s)
                    ? s.Levels.ToDictionary(level => level.Ordinal, level => level.Label)
                    : new Dictionary<int, string>()))
            .ToArray();
    }

    private static Result<IReadOnlyList<SkillExpectationSetDto>> EvaluationForbidden() =>
        Result.Failure<IReadOnlyList<SkillExpectationSetDto>>(Error.Forbidden(
            "Evaluations.Forbidden",
            "You do not have permission to read skills configuration for rounds."));
}

internal static class SkillsConfigurationQuerySupport
{
    public static async Task<IReadOnlyDictionary<Guid, (string Name, string CategoryName)>> BuildSkillLookupAsync(
        PerformanceDbContext db,
        IReadOnlyCollection<Guid> skillIds,
        CancellationToken cancellationToken)
    {
        if (skillIds.Count == 0)
            return new Dictionary<Guid, (string, string)>();

        var rows = await db.Skills
            .AsNoTracking()
            .Where(skill => skillIds.Contains(skill.Id))
            .Join(db.SkillCategories.AsNoTracking(),
                skill => skill.SkillCategoryId,
                category => category.Id,
                (skill, category) => new { skill.Id, skill.Name, CategoryName = category.Name })
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(row => row.Id, row => (row.Name, row.CategoryName));
    }
}
