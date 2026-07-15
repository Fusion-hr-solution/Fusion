using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A reusable, tenant-scoped objective definition maintained by HR. The source pool the
/// later objective-planning feature will draw from. Standalone in this feature: not yet
/// linked to cycles or employees.
/// </summary>
public class ObjectiveTemplate : AggregateRoot, ITenantEntity
{
    private ObjectiveTemplate() { }

    public Guid TenantId { get; private set; }

    /// <summary>Row version for optimistic concurrency control (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Category { get; private set; }
    public ObjectiveTemplateLevel Level { get; private set; }
    public Guid? ParentTemplateId { get; private set; }
    public string? SuccessMeasure { get; private set; }
    public string? Target { get; private set; }

    /// <summary>Optional suggested weight (percentage 0-100) when adopted into a plan.</summary>
    public decimal? DefaultWeight { get; private set; }

    public ObjectiveTemplateStatus Status { get; private set; }

    public bool IsReadyForPlanning => Status == ObjectiveTemplateStatus.Active
        && !string.IsNullOrWhiteSpace(SuccessMeasure)
        && !string.IsNullOrWhiteSpace(Target);

    public static ObjectiveTemplate Create(
        Guid tenantId,
        string name,
        string? description = null,
        string? category = null,
        decimal? defaultWeight = null,
        string? successMeasure = null,
        string? target = null,
        ObjectiveTemplateLevel level = ObjectiveTemplateLevel.Individual,
        Guid? parentTemplateId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        var template = new ObjectiveTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Status = ObjectiveTemplateStatus.Active
        };

        template.ApplyDetails(name, description, category, defaultWeight, successMeasure, target, level, parentTemplateId);
        return template;
    }

    public void UpdateDetails(
        string name,
        string? description,
        string? category,
        decimal? defaultWeight,
        string? successMeasure = null,
        string? target = null,
        ObjectiveTemplateLevel level = ObjectiveTemplateLevel.Individual,
        Guid? parentTemplateId = null)
    {
        ApplyDetails(name, description, category, defaultWeight, successMeasure, target, level, parentTemplateId);
        Touch();
    }

    public void Archive()
    {
        if (Status == ObjectiveTemplateStatus.Archived)
            throw new DomainRuleViolationException("Objective template is already archived.");

        Status = ObjectiveTemplateStatus.Archived;
        Touch();
    }

    public void Restore()
    {
        if (Status == ObjectiveTemplateStatus.Active)
            throw new DomainRuleViolationException("Objective template is already active.");

        Status = ObjectiveTemplateStatus.Active;
        Touch();
    }

    private void ApplyDetails(
        string name,
        string? description,
        string? category,
        decimal? defaultWeight,
        string? successMeasure,
        string? target,
        ObjectiveTemplateLevel level,
        Guid? parentTemplateId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Objective template name cannot be empty.", nameof(name));

        var normalizedName = name.Trim();
        if (normalizedName.Length > 200)
            throw new ArgumentException("Objective template name cannot exceed 200 characters.", nameof(name));

        if (defaultWeight is < 0 or > 100)
            throw new ArgumentException("Default weight must be between 0 and 100.", nameof(defaultWeight));

        if (!Enum.IsDefined(level))
            throw new ArgumentOutOfRangeException(nameof(level));

        var normalizedMeasure = string.IsNullOrWhiteSpace(successMeasure) ? null : successMeasure.Trim();
        var normalizedTarget = string.IsNullOrWhiteSpace(target) ? null : target.Trim();
        if (normalizedMeasure?.Length > 500)
            throw new ArgumentException("Success measure cannot exceed 500 characters.", nameof(successMeasure));
        if (normalizedTarget?.Length > 500)
            throw new ArgumentException("Target cannot exceed 500 characters.", nameof(target));
        if (parentTemplateId == Id)
            throw new DomainRuleViolationException("An objective template cannot align to itself.");

        Name = normalizedName;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim();
        DefaultWeight = defaultWeight;
        Level = level;
        ParentTemplateId = parentTemplateId;
        SuccessMeasure = normalizedMeasure;
        Target = normalizedTarget;
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
