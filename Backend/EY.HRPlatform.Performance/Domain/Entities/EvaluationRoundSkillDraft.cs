using EY.HRPlatform.Performance.Domain.Entities.Skills;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A round-draft copy of one proficiency scale level, mirroring
/// <see cref="EvaluationRoundScaleDraftLevel"/>. Copied on expectation-set
/// selection so later source edits never reach the round.
/// </summary>
public sealed class EvaluationRoundProficiencyDraftLevel : BaseEntity, ITenantEntity
{
    private EvaluationRoundProficiencyDraftLevel() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceLevelId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    internal static EvaluationRoundProficiencyDraftLevel Copy(
        Guid tenantId,
        Guid roundId,
        ProficiencyScaleLevel source) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceLevelId = source.Id,
            Ordinal = source.Ordinal,
            Label = source.Label,
            Description = source.Description
        };
}

/// <summary>
/// A round-draft copy of one expected skill, mirroring the two-stage copy of
/// the rating scale. The expected level is a proficiency-scale ordinal bounded
/// by the copied <see cref="EvaluationRoundProficiencyDraftLevel"/> set.
/// </summary>
public sealed class EvaluationRoundSkillDraftItem : BaseEntity, ITenantEntity
{
    private EvaluationRoundSkillDraftItem() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SkillId { get; private set; }
    public string SkillName { get; private set; } = string.Empty;
    public string CategoryName { get; private set; } = string.Empty;
    public int ExpectedLevelOrdinal { get; private set; }

    internal static EvaluationRoundSkillDraftItem Copy(
        Guid tenantId,
        Guid roundId,
        Guid skillId,
        string skillName,
        string categoryName,
        int expectedLevelOrdinal) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SkillId = skillId,
            SkillName = skillName,
            CategoryName = categoryName,
            ExpectedLevelOrdinal = expectedLevelOrdinal
        };

    internal void SetExpectedLevel(int expectedLevelOrdinal)
    {
        ExpectedLevelOrdinal = expectedLevelOrdinal;
        UpdatedAt = DateTime.UtcNow;
    }
}
