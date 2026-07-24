using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// A reusable discrete proficiency scale owned by one tenant. Level values are
/// the one-based ordinal positions. A separate concept from the evaluation
/// rating scale — this type never inherits from or references it.
/// </summary>
public sealed class ProficiencyScale : AggregateRoot, ITenantEntity
{
    public const int MinimumLevelCount = 3;
    public const int MaximumLevelCount = 7;
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;

    private readonly List<ProficiencyScaleLevel> _levels = new();

    private ProficiencyScale() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public EvaluationConfigStatus Status { get; private set; }
    public bool IsInUse { get; private set; }
    public uint Version { get; private set; }

    public IReadOnlyCollection<ProficiencyScaleLevel> Levels =>
        _levels.OrderBy(level => level.Ordinal).ToArray();

    public static ProficiencyScale CreateDraft(
        Guid tenantId,
        string name,
        string? description,
        IReadOnlyCollection<ProficiencyScaleLevelDraft> levels)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));

        ValidateLevelCount(levels?.Count ?? 0);

        var scale = new ProficiencyScale
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Status = EvaluationConfigStatus.Draft
        };
        scale.UpdateDetails(name, description);

        var ordinal = 1;
        foreach (var level in levels!)
        {
            scale._levels.Add(ProficiencyScaleLevel.Create(
                tenantId,
                scale.Id,
                ordinal++,
                level.Label,
                level.Description));
        }

        return scale;
    }

    public void UpdateDetails(string name, string? description)
    {
        EnsureNotArchived();
        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    public ProficiencyScaleLevel AddLevel(ProficiencyScaleLevelDraft level)
    {
        EnsureStructureEditable();
        ValidateLevelCount(_levels.Count + 1);

        var created = ProficiencyScaleLevel.Create(
            TenantId,
            Id,
            _levels.Count + 1,
            level.Label,
            level.Description);
        _levels.Add(created);
        UpdatedAt = DateTime.UtcNow;
        return created;
    }

    public void UpdateLevel(Guid levelId, string label, string? description)
    {
        EnsureStructureEditable();
        var level = FindLevel(levelId);
        level.Update(level.Ordinal, label, description);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveLevel(Guid levelId)
    {
        EnsureStructureEditable();
        ValidateLevelCount(_levels.Count - 1);

        var level = FindLevel(levelId);
        _levels.Remove(level);
        ResequenceLevels(_levels.OrderBy(item => item.Ordinal));
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReorderLevels(IReadOnlyCollection<Guid> orderedLevelIds)
    {
        EnsureStructureEditable();
        if (orderedLevelIds is null ||
            orderedLevelIds.Count != _levels.Count ||
            orderedLevelIds.Count != orderedLevelIds.Distinct().Count() ||
            orderedLevelIds.Any(id => _levels.All(level => level.Id != id)))
        {
            throw new DomainRuleViolationException("The proficiency level order must include every level exactly once.");
        }

        ResequenceLevels(orderedLevelIds.Select(FindLevel));
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        if (Status != EvaluationConfigStatus.Draft)
            throw new DomainRuleViolationException("Only a draft proficiency scale can be activated.");

        ValidateLevelCount(_levels.Count);
        Status = EvaluationConfigStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active proficiency scale can be archived.");

        Status = EvaluationConfigStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInUse()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active proficiency scale can be used by a launched round.");

        IsInUse = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public ProficiencyScale Duplicate(string name) =>
        CreateDraft(
            TenantId,
            name,
            Description,
            Levels.Select(level => new ProficiencyScaleLevelDraft(
                level.Label,
                level.Description)).ToArray());

    public void EnsureCanDelete(bool isReferenced)
    {
        if (isReferenced)
            throw new DomainRuleViolationException("A referenced proficiency scale cannot be deleted.");
    }

    private ProficiencyScaleLevel FindLevel(Guid levelId) =>
        _levels.SingleOrDefault(level => level.Id == levelId)
        ?? throw new DomainRuleViolationException("The proficiency level does not belong to this scale.");

    private void EnsureStructureEditable()
    {
        EnsureNotArchived();
        if (IsInUse)
            throw new DomainRuleViolationException(
                "This proficiency scale is in use. Duplicate it to change its levels.");
    }

    private void EnsureNotArchived()
    {
        if (Status == EvaluationConfigStatus.Archived)
            throw new DomainRuleViolationException("An archived proficiency scale is read-only.");
    }

    private static void ResequenceLevels(IEnumerable<ProficiencyScaleLevel> orderedLevels)
    {
        var ordinal = 1;
        foreach (var level in orderedLevels)
            level.SetOrdinal(ordinal++);
    }

    private static void ValidateLevelCount(int count)
    {
        if (count is < MinimumLevelCount or > MaximumLevelCount)
        {
            throw new DomainRuleViolationException(
                $"A proficiency scale must contain between {MinimumLevelCount} and {MaximumLevelCount} levels.");
        }
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A proficiency scale requires a name.");

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }
}
