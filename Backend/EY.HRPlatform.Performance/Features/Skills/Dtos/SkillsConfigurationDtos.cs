using EY.HRPlatform.Performance.Domain.Entities.Skills;

namespace EY.HRPlatform.Performance.Features.Skills.Dtos;

// ─── Inputs ────────────────────────────────────────────────────────────────

public sealed record ProficiencyScaleLevelInput(
    Guid? Id,
    string Label,
    string? Description);

public sealed record SkillExpectationItemInput(
    Guid SkillId,
    int ExpectedLevelOrdinal);

// ─── Read models ───────────────────────────────────────────────────────────

public sealed record SkillCategoryDto(
    Guid Id,
    string Name,
    string Status,
    int ActiveSkillCount,
    uint Version);

public sealed record SkillDto(
    Guid Id,
    string Name,
    string? Description,
    Guid CategoryId,
    string CategoryName,
    string Status,
    bool IsInUse,
    uint Version);

public sealed record ProficiencyScaleLevelDto(
    Guid Id,
    int Ordinal,
    int Value,
    string Label,
    string? Description);

public sealed record ProficiencyScaleDto(
    Guid Id,
    string Name,
    string? Description,
    string Status,
    bool IsInUse,
    uint Version,
    IReadOnlyList<ProficiencyScaleLevelDto> Levels);

public sealed record SkillExpectationItemDto(
    Guid Id,
    Guid SkillId,
    string SkillName,
    string CategoryName,
    int ExpectedLevelOrdinal,
    string ExpectedLevelLabel);

public sealed record SkillExpectationSetDto(
    Guid Id,
    string Name,
    string? Description,
    Guid ProficiencyScaleId,
    string ProficiencyScaleName,
    string Status,
    bool IsInUse,
    uint Version,
    IReadOnlyList<SkillExpectationItemDto> Items);

public sealed record SkillsConfigurationWorkspaceDto(
    IReadOnlyList<SkillCategoryDto> Categories,
    IReadOnlyList<SkillDto> Skills,
    IReadOnlyList<ProficiencyScaleDto> ProficiencyScales,
    IReadOnlyList<SkillExpectationSetDto> ExpectationSets);

/// <summary>
/// Read-side projection helpers. Item-level names are resolved from lookups the
/// query handler supplies so the API never leaks ids without their product labels.
/// </summary>
public static class SkillsConfigurationMapper
{
    public static SkillCategoryDto ToDto(SkillCategory category, int activeSkillCount) => new(
        category.Id,
        category.Name,
        category.Status.ToString(),
        activeSkillCount,
        category.Version);

    public static SkillDto ToDto(Skill skill, IReadOnlyDictionary<Guid, string> categoryNames) => new(
        skill.Id,
        skill.Name,
        skill.Description,
        skill.SkillCategoryId,
        categoryNames.TryGetValue(skill.SkillCategoryId, out var categoryName) ? categoryName : string.Empty,
        skill.Status.ToString(),
        skill.IsInUse,
        skill.Version);

    public static ProficiencyScaleDto ToDto(ProficiencyScale scale) => new(
        scale.Id,
        scale.Name,
        scale.Description,
        scale.Status.ToString(),
        scale.IsInUse,
        scale.Version,
        scale.Levels.Select(level => new ProficiencyScaleLevelDto(
            level.Id,
            level.Ordinal,
            level.Value,
            level.Label,
            level.Description)).ToArray());

    public static SkillExpectationSetDto ToDto(
        SkillExpectationSet set,
        string proficiencyScaleName,
        IReadOnlyDictionary<Guid, (string Name, string CategoryName)> skillLookup,
        IReadOnlyDictionary<int, string> levelLabels) => new(
        set.Id,
        set.Name,
        set.Description,
        set.ProficiencyScaleId,
        proficiencyScaleName,
        set.Status.ToString(),
        set.IsInUse,
        set.Version,
        set.Items
            .OrderBy(item => item.ExpectedLevelOrdinal)
            .Select(item => new SkillExpectationItemDto(
                item.Id,
                item.SkillId,
                skillLookup.TryGetValue(item.SkillId, out var skill) ? skill.Name : string.Empty,
                skillLookup.TryGetValue(item.SkillId, out var category) ? category.CategoryName : string.Empty,
                item.ExpectedLevelOrdinal,
                levelLabels.TryGetValue(item.ExpectedLevelOrdinal, out var label) ? label : string.Empty))
            .ToArray());
}
