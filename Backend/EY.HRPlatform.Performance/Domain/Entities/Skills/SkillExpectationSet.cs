using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// A tenant-owned set of expected proficiencies (one expected level per skill),
/// bound to a single proficiency scale. Draft → Active → Archived, duplicate to
/// evolve, structural freeze once used by a launched round. No per-item weights.
/// </summary>
public sealed class SkillExpectationSet : AggregateRoot, ITenantEntity
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;
    public const int MinimumItemCount = 1;
    public const int MaximumItemCount = 25;

    private readonly List<SkillExpectationItem> _items = new();

    private SkillExpectationSet() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    /// <summary>Case-folded key backing tenant-unique names (DB-enforced, case-insensitive).</summary>
    public string NormalizedName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid ProficiencyScaleId { get; private set; }
    public EvaluationConfigStatus Status { get; private set; }
    public bool IsInUse { get; private set; }
    public uint Version { get; private set; }

    public IReadOnlyCollection<SkillExpectationItem> Items => _items.ToArray();

    public static SkillExpectationSet CreateDraft(
        Guid tenantId,
        string name,
        string? description,
        Guid proficiencyScaleId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (proficiencyScaleId == Guid.Empty)
            throw new DomainRuleViolationException("An expectation set requires a proficiency scale.");

        var set = new SkillExpectationSet
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProficiencyScaleId = proficiencyScaleId,
            Status = EvaluationConfigStatus.Draft
        };
        set.UpdateDetails(name, description);
        return set;
    }

    public void UpdateDetails(string name, string? description)
    {
        EnsureNotArchived();
        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        NormalizedName = Name.ToUpperInvariant();
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    public SkillExpectationItem AddItem(Guid skillId, int expectedLevelOrdinal, ProficiencyScale scale)
    {
        EnsureStructureEditable();
        EnsureScaleMatches(scale);
        EnsureOrdinalOnScale(expectedLevelOrdinal, scale);
        if (_items.Any(item => item.SkillId == skillId))
            throw new DomainRuleViolationException("This skill is already in the expectation set.");
        if (_items.Count + 1 > MaximumItemCount)
            throw new DomainRuleViolationException(
                $"An expectation set cannot contain more than {MaximumItemCount} skills.");

        var created = SkillExpectationItem.Create(TenantId, Id, skillId, expectedLevelOrdinal);
        _items.Add(created);
        UpdatedAt = DateTime.UtcNow;
        return created;
    }

    public void UpdateItemExpectedLevel(Guid itemId, int expectedLevelOrdinal, ProficiencyScale scale)
    {
        EnsureStructureEditable();
        EnsureScaleMatches(scale);
        EnsureOrdinalOnScale(expectedLevelOrdinal, scale);
        var item = FindItem(itemId);
        item.SetExpectedLevel(expectedLevelOrdinal);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveItem(Guid itemId)
    {
        EnsureStructureEditable();
        var item = FindItem(itemId);
        _items.Remove(item);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate(ProficiencyScale scale)
    {
        if (Status != EvaluationConfigStatus.Draft)
            throw new DomainRuleViolationException("Only a draft expectation set can be activated.");

        EnsureScaleActiveAndOwned(scale);
        if (_items.Count < MinimumItemCount)
            throw new DomainRuleViolationException(
                $"An expectation set must contain at least {MinimumItemCount} skill.");
        foreach (var item in _items)
            EnsureOrdinalOnScale(item.ExpectedLevelOrdinal, scale);

        Status = EvaluationConfigStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active expectation set can be archived.");

        Status = EvaluationConfigStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInUse()
    {
        if (Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("Only an active expectation set can be used by a launched round.");

        IsInUse = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public SkillExpectationSet Duplicate(string name)
    {
        var copy = CreateDraft(TenantId, name, Description, ProficiencyScaleId);
        foreach (var item in _items)
        {
            copy._items.Add(SkillExpectationItem.Create(
                TenantId,
                copy.Id,
                item.SkillId,
                item.ExpectedLevelOrdinal));
        }
        return copy;
    }

    private SkillExpectationItem FindItem(Guid itemId) =>
        _items.SingleOrDefault(item => item.Id == itemId)
        ?? throw new DomainRuleViolationException("The expectation item does not belong to this set.");

    private void EnsureStructureEditable()
    {
        EnsureNotArchived();
        if (IsInUse)
            throw new DomainRuleViolationException(
                "This expectation set is in use. Duplicate it to change its skills.");
    }

    private void EnsureNotArchived()
    {
        if (Status == EvaluationConfigStatus.Archived)
            throw new DomainRuleViolationException("An archived expectation set is read-only.");
    }

    private void EnsureScaleMatches(ProficiencyScale scale)
    {
        if (scale is null)
            throw new ArgumentNullException(nameof(scale));
        if (scale.Id != ProficiencyScaleId || scale.TenantId != TenantId)
            throw new DomainRuleViolationException("The proficiency scale does not match this expectation set.");
    }

    private void EnsureScaleActiveAndOwned(ProficiencyScale scale)
    {
        EnsureScaleMatches(scale);
        if (scale.Status != EvaluationConfigStatus.Active)
            throw new DomainRuleViolationException("The expectation set's proficiency scale must be active.");
    }

    private static void EnsureOrdinalOnScale(int expectedLevelOrdinal, ProficiencyScale scale)
    {
        if (scale.Levels.All(level => level.Ordinal != expectedLevelOrdinal))
            throw new DomainRuleViolationException(
                "The expected level is not a level on the proficiency scale.");
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("An expectation set requires a name.");

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
