using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A time-bounded performance cycle (campaign) scoped to a population of employees.
/// Root of the cycle aggregate: owns its population rules and (once published) the
/// immutable participant snapshot. Lifecycle: Draft -> AssignmentPreparation -> ReadyToLaunch -> Active -> Closed.
/// </summary>
public class PerformanceCycle : AggregateRoot, ITenantEntity
{
    private readonly List<PerformanceCyclePopulationRule> _populationRules = new();
    private readonly List<PerformanceCycleParticipant> _participants = new();
    private readonly List<CampaignExceptionOwner> _exceptionOwners = new();

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
    public DateTime? AssignmentPreparationStartedAt { get; private set; }
    public DateTime? ReadyToLaunchAt { get; private set; }
    public DateTime? ActivatedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }

    /// <summary>Draft governance selection. It becomes immutable at preparation start.</summary>
    public Guid? RetentionPolicyVersionId { get; private set; }
    public bool RequireTeamObjectiveSuperiorApproval { get; private set; }
    public int MinimumAnonymousFeedbackResponses { get; private set; } = 3;
    public CampaignFeedbackVisibility FeedbackVisibility { get; private set; } = CampaignFeedbackVisibility.AnonymousToSubject;

    /// <summary>Optional deadline by which the feedback window closes. Frozen at publish.</summary>
    public DateTime? FeedbackDeadline { get; private set; }

    /// <summary>Governance values frozen when the campaign leaves draft.</summary>
    public Guid? FrozenRetentionPolicyVersionId { get; private set; }
    public bool? FrozenRequireTeamObjectiveSuperiorApproval { get; private set; }
    public int? FrozenMinimumAnonymousFeedbackResponses { get; private set; }
    public CampaignFeedbackVisibility? FrozenFeedbackVisibility { get; private set; }
    public DateTime? GovernanceFrozenAt { get; private set; }

    public IReadOnlyCollection<PerformanceCyclePopulationRule> PopulationRules => _populationRules.AsReadOnly();
    public IReadOnlyCollection<PerformanceCycleParticipant> Participants => _participants.AsReadOnly();
    public IReadOnlyCollection<CampaignExceptionOwner> ExceptionOwners => _exceptionOwners.AsReadOnly();

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

    public void ConfigureGovernance(
        Guid retentionPolicyVersionId,
        bool requireTeamObjectiveSuperiorApproval,
        int minimumAnonymousFeedbackResponses,
        CampaignFeedbackVisibility feedbackVisibility,
        IEnumerable<Guid> exceptionOwnerEmployeeIds)
    {
        EnsureEditable();
        if (retentionPolicyVersionId == Guid.Empty)
            throw new ArgumentException("A retention policy version is required.", nameof(retentionPolicyVersionId));
        if (minimumAnonymousFeedbackResponses < 3)
            throw new ArgumentOutOfRangeException(nameof(minimumAnonymousFeedbackResponses),
                "The anonymous feedback threshold cannot be below three responses.");

        var owners = exceptionOwnerEmployeeIds.Distinct().ToList();
        if (owners.Count == 0 || owners.Any(id => id == Guid.Empty))
            throw new ArgumentException("At least one exception owner is required.", nameof(exceptionOwnerEmployeeIds));

        RetentionPolicyVersionId = retentionPolicyVersionId;
        RequireTeamObjectiveSuperiorApproval = requireTeamObjectiveSuperiorApproval;
        MinimumAnonymousFeedbackResponses = minimumAnonymousFeedbackResponses;
        FeedbackVisibility = feedbackVisibility;
        _exceptionOwners.Clear();
        for (var index = 0; index < owners.Count; index++)
            _exceptionOwners.Add(CampaignExceptionOwner.Create(TenantId, Id, owners[index], index + 1));
        Touch();
    }

    /// <summary>Begins materialising assignment candidates from the current Core workforce context.</summary>
    public void BeginAssignmentPreparation(int candidateCount, DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.Draft)
            throw new DomainRuleViolationException("Only a draft campaign can begin assignment preparation.");

        if (candidateCount <= 0)
            throw new DomainRuleViolationException("A campaign cannot prepare assignments for an empty population.");

        EnsureGovernanceConfigured();

        var now = NormalizeUtc(occurredAt, nameof(occurredAt));
        if (now > PeriodEnd)
            throw new DomainRuleViolationException("A campaign cannot begin preparation after its period has ended.");

        if (ObjectiveSettingDeadline.HasValue && now > ObjectiveSettingDeadline.Value)
            throw new DomainRuleViolationException("A campaign cannot begin preparation after its objective-setting deadline.");

        Status = PerformanceCycleStatus.AssignmentPreparation;
        PublishedAt = now;
        AssignmentPreparationStartedAt = now;
        FrozenRetentionPolicyVersionId = RetentionPolicyVersionId;
        FrozenRequireTeamObjectiveSuperiorApproval = RequireTeamObjectiveSuperiorApproval;
        FrozenMinimumAnonymousFeedbackResponses = MinimumAnonymousFeedbackResponses;
        FrozenFeedbackVisibility = FeedbackVisibility;
        GovernanceFrozenAt = now;
        Touch();
    }

    /// <summary>Compatibility entry point for callers not yet migrated to Packet A terminology.</summary>
    public void Publish(int resolvedPopulationCount, DateTime occurredAt)
        => BeginAssignmentPreparation(resolvedPopulationCount, occurredAt);

    public void MarkReadyToLaunch(
        int finalResponsibilityCount,
        int readinessFailureCount,
        bool hasAcceptedWorkforceDelta,
        DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.AssignmentPreparation)
            throw new DomainRuleViolationException("Only a campaign in assignment preparation can become ready to launch.");

        if (finalResponsibilityCount <= 0)
            throw new DomainRuleViolationException("A campaign needs at least one final responsibility before launch.");

        if (readinessFailureCount > 0)
            throw new DomainRuleViolationException("All assignment readiness failures must be resolved before launch.");

        if (!hasAcceptedWorkforceDelta)
            throw new DomainRuleViolationException("The current Core workforce delta must be explicitly accepted before launch.");

        var now = NormalizeUtc(occurredAt, nameof(occurredAt));
        Status = PerformanceCycleStatus.ReadyToLaunch;
        ReadyToLaunchAt = now;
        Touch();
    }

    public void Activate(DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.ReadyToLaunch)
            throw new DomainRuleViolationException("Only a ready-to-launch campaign can be activated.");

        var now = NormalizeUtc(occurredAt, nameof(occurredAt));
        if (now < PeriodStart)
            throw new DomainRuleViolationException("A cycle cannot be activated before its period starts.");

        if (now > PeriodEnd)
            throw new DomainRuleViolationException("A cycle cannot be activated after its period has ended.");

        Status = PerformanceCycleStatus.Active;
        ActivatedAt = now;
        Touch();
    }

    public void Close(DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.Active)
            throw new DomainRuleViolationException("Only an active campaign can be closed.");

        var now = NormalizeUtc(occurredAt, nameof(occurredAt));
        if (now < PeriodEnd)
            throw new DomainRuleViolationException("A cycle cannot be closed before its period ends.");

        Status = PerformanceCycleStatus.Closed;
        ClosedAt = now;
        Touch();
    }

    public void RecordResponsibilityChange()
    {
        if (Status != PerformanceCycleStatus.AssignmentPreparation)
            throw new DomainRuleViolationException("Responsibilities can only be changed during preparation.");

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

    private void EnsureGovernanceConfigured()
    {
        if (RetentionPolicyVersionId is null || _exceptionOwners.Count == 0)
            throw new DomainRuleViolationException(
                "A retention policy version and at least one exception owner must be configured before assignment preparation.");
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
