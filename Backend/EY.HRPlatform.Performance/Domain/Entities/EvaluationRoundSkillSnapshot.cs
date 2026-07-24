using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The immutable skill expectation frozen at round launch, mirroring
/// <see cref="EvaluationRoundScaleSnapshot"/>. One per round; assignments
/// reference it through <see cref="EvaluationAssignment.SkillSnapshotId"/>.
/// </summary>
public sealed class EvaluationRoundSkillSnapshot : BaseEntity, ITenantEntity
{
    private readonly List<EvaluationRoundSkillSnapshotLevel> _levels = new();
    private readonly List<EvaluationRoundSkillSnapshotItem> _items = new();
    private EvaluationRoundSkillSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid SourceExpectationSetId { get; private set; }
    public string SetName { get; private set; } = string.Empty;
    public string ProficiencyScaleName { get; private set; } = string.Empty;

    public IReadOnlyCollection<EvaluationRoundSkillSnapshotLevel> Levels =>
        _levels.OrderBy(level => level.Ordinal).ToArray();
    public IReadOnlyCollection<EvaluationRoundSkillSnapshotItem> Items => _items.ToArray();

    internal static EvaluationRoundSkillSnapshot Capture(
        Guid tenantId,
        Guid roundId,
        Guid sourceExpectationSetId,
        string setName,
        string proficiencyScaleName,
        IEnumerable<EvaluationRoundProficiencyDraftLevel> levels,
        IEnumerable<EvaluationRoundSkillDraftItem> items)
    {
        var snapshot = new EvaluationRoundSkillSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            SourceExpectationSetId = sourceExpectationSetId,
            SetName = setName,
            ProficiencyScaleName = proficiencyScaleName
        };
        snapshot._levels.AddRange(levels.OrderBy(level => level.Ordinal).Select(level =>
            EvaluationRoundSkillSnapshotLevel.Capture(tenantId, snapshot.Id, level)));
        snapshot._items.AddRange(items.Select(item =>
            EvaluationRoundSkillSnapshotItem.Capture(tenantId, snapshot.Id, item)));
        return snapshot;
    }
}

public sealed class EvaluationRoundSkillSnapshotLevel : BaseEntity, ITenantEntity
{
    private EvaluationRoundSkillSnapshotLevel() { }
    public Guid TenantId { get; private set; }
    public Guid SkillSnapshotId { get; private set; }
    public Guid SourceLevelId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    internal static EvaluationRoundSkillSnapshotLevel Capture(
        Guid tenantId,
        Guid skillSnapshotId,
        EvaluationRoundProficiencyDraftLevel level) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SkillSnapshotId = skillSnapshotId,
            SourceLevelId = level.SourceLevelId,
            Ordinal = level.Ordinal,
            Label = level.Label,
            Description = level.Description
        };
}

public sealed class EvaluationRoundSkillSnapshotItem : BaseEntity, ITenantEntity
{
    private EvaluationRoundSkillSnapshotItem() { }
    public Guid TenantId { get; private set; }
    public Guid SkillSnapshotId { get; private set; }
    public Guid SkillId { get; private set; }
    public string SkillName { get; private set; } = string.Empty;
    public string CategoryName { get; private set; } = string.Empty;
    public int ExpectedLevelOrdinal { get; private set; }

    internal static EvaluationRoundSkillSnapshotItem Capture(
        Guid tenantId,
        Guid skillSnapshotId,
        EvaluationRoundSkillDraftItem item) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SkillSnapshotId = skillSnapshotId,
            SkillId = item.SkillId,
            SkillName = item.SkillName,
            CategoryName = item.CategoryName,
            ExpectedLevelOrdinal = item.ExpectedLevelOrdinal
        };
}
