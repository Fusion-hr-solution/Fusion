using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A time-bounded performance cycle (campaign) scoped to a population of employees.
/// Root of the cycle aggregate: owns its population rules and (once published) the
/// immutable participant snapshot. Lifecycle: Draft -> Published -> Active -> Closed.
/// </summary>
public class PerformanceCycle : AggregateRoot, ITenantEntity
{
    private readonly List<PerformanceCyclePopulationRule> _populationRules = new();
    private readonly List<PerformanceCycleParticipant> _participants = new();

    private PerformanceCycle() { }

    public Guid TenantId { get; private set; }

    /// <summary>Row version for optimistic concurrency control (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public PerformanceCycleType Type { get; private set; }

    public DateTime PeriodStart { get; private set; }
    public DateTime PeriodEnd { get; private set; }

    /// <summary>Optional deadline by which participants are expected to have set objectives.</summary>
    public DateTime? ObjectiveSettingDeadline { get; private set; }

    public PerformanceCycleStatus Status { get; private set; }

    /// <summary>When true, inactive employees are kept when resolving the population (default: active only).</summary>
    public bool PopulationIncludeInactive { get; private set; }

    public DateTime? PublishedAt { get; private set; }
    public DateTime? ActivatedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    public IReadOnlyCollection<PerformanceCyclePopulationRule> PopulationRules => _populationRules.AsReadOnly();
    public IReadOnlyCollection<PerformanceCycleParticipant> Participants => _participants.AsReadOnly();

    public bool IsEditable => Status == PerformanceCycleStatus.Draft;

    public static PerformanceCycle Create(
        Guid tenantId,
        string name,
        PerformanceCycleType type,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime? objectiveSettingDeadline = null,
        bool populationIncludeInactive = false,
        string? description = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        var cycle = new PerformanceCycle
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = type,
            Status = PerformanceCycleStatus.Draft,
            PopulationIncludeInactive = populationIncludeInactive
        };

        cycle.ApplyDetails(name, periodStart, periodEnd, objectiveSettingDeadline, description);
        return cycle;
    }

    public void UpdateDetails(
        string name,
        PerformanceCycleType type,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime? objectiveSettingDeadline,
        bool populationIncludeInactive,
        string? description)
    {
        EnsureEditable();
        Type = type;
        PopulationIncludeInactive = populationIncludeInactive;
        ApplyDetails(name, periodStart, periodEnd, objectiveSettingDeadline, description);
        Touch();
    }

    public void SetPopulation(bool populationIncludeInactive, IEnumerable<PerformanceCyclePopulationRule> rules)
    {
        EnsureEditable();
        PopulationIncludeInactive = populationIncludeInactive;
        _populationRules.Clear();
        foreach (var rule in rules)
        {
            _populationRules.Add(rule);
        }
        Touch();
    }

    /// <summary>
    /// Moves the cycle to Published once its population has been resolved. The handler resolves the
    /// population from Core and persists the immutable participant snapshot in the same transaction;
    /// this method enforces the "no publish without population" invariant via the resolved count.
    /// </summary>
    public void Publish(int resolvedPopulationCount)
    {
        if (Status != PerformanceCycleStatus.Draft)
            throw new DomainRuleViolationException("Only a draft cycle can be published.");

        if (resolvedPopulationCount <= 0)
            throw new DomainRuleViolationException("A cycle cannot be published with an empty population.");

        Status = PerformanceCycleStatus.Published;
        PublishedAt = DateTime.UtcNow;
        Touch();
    }

    public void Activate()
    {
        if (Status != PerformanceCycleStatus.Published)
            throw new DomainRuleViolationException("Only a published cycle can be activated.");

        Status = PerformanceCycleStatus.Active;
        ActivatedAt = DateTime.UtcNow;
        Touch();
    }

    public void Close()
    {
        if (Status is not (PerformanceCycleStatus.Published or PerformanceCycleStatus.Active))
            throw new DomainRuleViolationException("Only a published or active cycle can be closed.");

        Status = PerformanceCycleStatus.Closed;
        ClosedAt = DateTime.UtcNow;
        Touch();
    }

    private void ApplyDetails(
        string name,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime? objectiveSettingDeadline,
        string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Cycle name cannot be empty.", nameof(name));

        var normalizedName = name.Trim();
        if (normalizedName.Length > 200)
            throw new ArgumentException("Cycle name cannot exceed 200 characters.", nameof(name));

        var start = NormalizeUtc(periodStart, nameof(periodStart));
        var end = NormalizeUtc(periodEnd, nameof(periodEnd));
        if (end <= start)
            throw new ArgumentException("Period end must be after period start.", nameof(periodEnd));

        DateTime? deadline = null;
        if (objectiveSettingDeadline.HasValue)
        {
            deadline = NormalizeUtc(objectiveSettingDeadline.Value, nameof(objectiveSettingDeadline));
            if (deadline < start || deadline > end)
                throw new ArgumentException(
                    "Objective-setting deadline must fall within the cycle period.",
                    nameof(objectiveSettingDeadline));
        }

        Name = normalizedName;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        PeriodStart = start;
        PeriodEnd = end;
        ObjectiveSettingDeadline = deadline;
    }

    private void EnsureEditable()
    {
        if (!IsEditable)
            throw new DomainRuleViolationException("Only a draft cycle can be modified.");
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
