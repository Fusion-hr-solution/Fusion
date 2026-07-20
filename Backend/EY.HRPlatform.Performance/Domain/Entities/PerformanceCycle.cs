using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A time-bounded performance campaign scoped to a population of employees.
/// Root of the campaign aggregate: owns its population rules, draft-side approver overrides,
/// and (once launched) the immutable participant + approver baseline. Lean lifecycle: Draft -> Launched.
/// </summary>
public class PerformanceCycle : AggregateRoot, ITenantEntity
{
    private readonly List<PerformanceCyclePopulationRule> _populationRules = new();
    private readonly List<PerformanceCycleParticipant> _participants = new();
    private readonly List<PerformanceCycleApproverOverride> _approverOverrides = new();
    private readonly List<CampaignStrategicObjective> _strategicObjectives = new();

    private PerformanceCycle() { }

    public Guid TenantId { get; private set; }

    /// <summary>Row version for optimistic concurrency control (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Stable, tenant-unique, human-readable URL identity (e.g. "annual-planning-2026"), assigned at creation.</summary>
    public string Slug { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Purpose { get; private set; }
    public int? ReferenceYear { get; private set; }
    public Guid? OwnerUserId { get; private set; }
    public string? OwnerName { get; private set; }
    public PerformanceCycleType Type { get; private set; }

    public DateTime PeriodStart { get; private set; }
    public DateTime PeriodEnd { get; private set; }

    /// <summary>Optional deadline by which participants are expected to have set objectives.</summary>
    public DateTime? ObjectiveSettingDeadline { get; private set; }
    public DateTime? PlanningOpeningDate { get; private set; }
    public DateTime? EmployeeSubmissionDeadline { get; private set; }
    public DateTime? ManagerApprovalDeadline { get; private set; }
    public DateTime? ExpectedPlanningLockDate { get; private set; }
    public CampaignPlanningRulesSnapshot? PlanningRulesSnapshot { get; private set; }

    public PerformanceCycleStatus Status { get; private set; }

    /// <summary>When true, inactive employees are kept when resolving the population (default: active only).</summary>
    public bool PopulationIncludeInactive { get; private set; }

    public DateTime? LaunchedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public DateTime? PlanningLockedAt { get; private set; }
    public Guid? PlanningLockedByUserId { get; private set; }
    public string? PlanningLockedByName { get; private set; }

    public IReadOnlyCollection<PerformanceCyclePopulationRule> PopulationRules => _populationRules.AsReadOnly();
    public IReadOnlyCollection<PerformanceCycleParticipant> Participants => _participants.AsReadOnly();
    public IReadOnlyCollection<PerformanceCycleApproverOverride> ApproverOverrides => _approverOverrides.AsReadOnly();
    public IReadOnlyCollection<CampaignStrategicObjective> StrategicObjectives => _strategicObjectives.AsReadOnly();

    public bool IsEditable => Status == PerformanceCycleStatus.Draft;
    public bool IsPlanningLocked => PlanningLockedAt.HasValue;

    public static PerformanceCycle CreateDraft(
        Guid tenantId,
        string name,
        string slug,
        int referenceYear,
        string? purpose,
        Guid ownerUserId,
        string? ownerName,
        DateTime planningOpeningDate,
        DateTime employeeSubmissionDeadline,
        DateTime managerApprovalDeadline,
        DateTime expectedPlanningLockDate,
        CampaignPlanningRulesSnapshot planningRulesSnapshot)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (ownerUserId == Guid.Empty)
            throw new ArgumentException("Campaign owner is required.", nameof(ownerUserId));
        if (string.IsNullOrWhiteSpace(slug))
            throw new ArgumentException("Campaign slug is required.", nameof(slug));
        ArgumentNullException.ThrowIfNull(planningRulesSnapshot);

        var cycle = new PerformanceCycle
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Slug = slug.Trim().ToLowerInvariant(),
            Type = PerformanceCycleType.Annual,
            Status = PerformanceCycleStatus.Draft,
            PopulationIncludeInactive = false,
            OwnerUserId = ownerUserId,
            OwnerName = string.IsNullOrWhiteSpace(ownerName) ? null : ownerName.Trim(),
            PlanningRulesSnapshot = planningRulesSnapshot
        };

        cycle.ApplyDraftDetails(
            name,
            referenceYear,
            purpose,
            planningOpeningDate,
            employeeSubmissionDeadline,
            managerApprovalDeadline,
            expectedPlanningLockDate);
        return cycle;
    }

    public void UpdateDraftDetails(
        string name,
        int referenceYear,
        string? purpose,
        DateTime planningOpeningDate,
        DateTime employeeSubmissionDeadline,
        DateTime managerApprovalDeadline,
        DateTime expectedPlanningLockDate)
    {
        EnsureEditable();
        ApplyDraftDetails(
            name,
            referenceYear,
            purpose,
            planningOpeningDate,
            employeeSubmissionDeadline,
            managerApprovalDeadline,
            expectedPlanningLockDate);
        Touch();
    }

    public CampaignStrategicObjective AddStrategicObjective(
        string title,
        string? description,
        string? responsibleFunctionLabel)
    {
        EnsureEditable();
        var objective = CampaignStrategicObjective.Create(TenantId, Id, title, description, responsibleFunctionLabel);
        _strategicObjectives.Add(objective);
        Touch();
        return objective;
    }

    public void EditStrategicObjective(
        Guid objectiveId,
        string title,
        string? description,
        string? responsibleFunctionLabel)
    {
        EnsureEditable();
        FindStrategicObjective(objectiveId).Update(title, description, responsibleFunctionLabel);
        Touch();
    }

    public void SetStrategicObjectiveActive(Guid objectiveId, bool isActive)
    {
        EnsureEditable();
        FindStrategicObjective(objectiveId).SetActive(isActive);
        Touch();
    }

    public CampaignDraftCompleteness EvaluateDraftCompleteness()
    {
        var reasons = new List<string>();

        if (string.IsNullOrWhiteSpace(Name))
            reasons.Add("Campaign name is required.");
        if (!ReferenceYear.HasValue)
            reasons.Add("Reference year is required.");
        if (!HasCompletePlanningSchedule())
            reasons.Add("Planning schedule is incomplete.");
        else if (!IsPlanningScheduleOrdered())
            reasons.Add("Planning schedule dates must be ordered.");
        if (PlanningRulesSnapshot is null)
            reasons.Add("Planning rules snapshot is required.");
        if (!_strategicObjectives.Any(objective => objective.IsActive))
            reasons.Add("At least one active strategic objective is required.");

        return reasons.Count == 0
            ? CampaignDraftCompleteness.Complete
            : CampaignDraftCompleteness.Blocked(reasons);
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

    /// <summary>Sets or replaces the draft-side approver override for a single participant employee.</summary>
    public void OverrideApprover(Guid participantEmployeeId, Guid approverEmployeeId, string approverName, string reason)
    {
        EnsureEditable();
        if (participantEmployeeId == Guid.Empty)
            throw new ArgumentException("A participant is required.", nameof(participantEmployeeId));

        var existing = _approverOverrides.FirstOrDefault(o => o.ParticipantEmployeeId == participantEmployeeId);
        if (existing is null)
            _approverOverrides.Add(PerformanceCycleApproverOverride.Create(
                TenantId, Id, participantEmployeeId, approverEmployeeId, approverName, reason));
        else
            existing.Update(approverEmployeeId, approverName, reason);
        Touch();
    }

    /// <summary>
    /// Launches the campaign in a single Draft -> Launched transition, freezing one immutable
    /// participant record per included employee (identity, org/team context, and resolved approver).
    /// The caller is responsible for having recomputed readiness server-side; the aggregate refuses
    /// to launch an incomplete draft, an empty population, or a participant without a resolved approver.
    /// Not re-runnable once launched.
    /// </summary>
    public void Launch(IReadOnlyCollection<ResolvedLaunchParticipant> resolvedBaseline, DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.Draft)
            throw new DomainRuleViolationException("Only a draft campaign can be launched.");

        var completeness = EvaluateDraftCompleteness();
        if (!completeness.IsComplete)
            throw new DomainRuleViolationException(
                "The campaign draft is not complete: " + string.Join(" ", completeness.BlockingReasons));

        if (resolvedBaseline is null || resolvedBaseline.Count == 0)
            throw new DomainRuleViolationException("A campaign cannot launch with an empty population.");

        var now = NormalizeUtc(occurredAt, nameof(occurredAt));

        _participants.Clear();
        foreach (var participant in resolvedBaseline)
        {
            if (participant.ApproverEmployeeId == Guid.Empty)
                throw new DomainRuleViolationException(
                    $"Participant '{participant.FullName}' has no resolvable approver.");

            _participants.Add(PerformanceCycleParticipant.Create(
                TenantId,
                Id,
                participant.EmployeeId,
                participant.FullName,
                participant.ApproverEmployeeId,
                participant.ApproverName,
                participant.IsApproverOverridden,
                participant.ApproverOverrideReason,
                participant.EmployeeKey,
                participant.Email,
                participant.OrgUnitId,
                participant.OrgUnitName,
                participant.JobTitle,
                participant.ManagerId,
                participant.ManagerName,
                now));
        }

        Status = PerformanceCycleStatus.Launched;
        LaunchedAt = now;
        Touch();
    }

    public void LockPlanning(Guid? actorUserId, string? actorName, DateTime occurredAt)
    {
        if (Status != PerformanceCycleStatus.Launched)
            throw new DomainRuleViolationException("Only a launched campaign can be locked for planning.");
        if (IsPlanningLocked)
            throw new DomainRuleViolationException("Planning is already locked for this campaign.");

        PlanningLockedAt = NormalizeUtc(occurredAt, nameof(occurredAt));
        PlanningLockedByUserId = actorUserId;
        PlanningLockedByName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim();
        Touch();
    }

    private void ApplyDraftDetails(
        string name,
        int referenceYear,
        string? purpose,
        DateTime planningOpeningDate,
        DateTime employeeSubmissionDeadline,
        DateTime managerApprovalDeadline,
        DateTime expectedPlanningLockDate)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Campaign name cannot be empty.", nameof(name));

        var normalizedName = name.Trim();
        if (normalizedName.Length > 200)
            throw new ArgumentException("Campaign name cannot exceed 200 characters.", nameof(name));
        if (referenceYear is < 2000 or > 2100)
            throw new ArgumentOutOfRangeException(nameof(referenceYear), "Reference year must be between 2000 and 2100.");

        var purposeText = string.IsNullOrWhiteSpace(purpose) ? null : purpose.Trim();
        if (purposeText?.Length > 2000)
            throw new ArgumentException("Campaign purpose cannot exceed 2000 characters.", nameof(purpose));

        var opening = NormalizeUtc(planningOpeningDate, nameof(planningOpeningDate));
        var submission = NormalizeUtc(employeeSubmissionDeadline, nameof(employeeSubmissionDeadline));
        var approval = NormalizeUtc(managerApprovalDeadline, nameof(managerApprovalDeadline));
        var lockDate = NormalizeUtc(expectedPlanningLockDate, nameof(expectedPlanningLockDate));

        EnsureOrdered(opening, submission, nameof(employeeSubmissionDeadline), "Employee submission deadline cannot be before planning opening date.");
        EnsureOrdered(submission, approval, nameof(managerApprovalDeadline), "Manager approval deadline cannot be before employee submission deadline.");
        EnsureOrdered(approval, lockDate, nameof(expectedPlanningLockDate), "Expected planning lock date cannot be before manager approval deadline.");

        Name = normalizedName;
        Description = purposeText;
        Purpose = purposeText;
        ReferenceYear = referenceYear;
        PlanningOpeningDate = opening;
        EmployeeSubmissionDeadline = submission;
        ManagerApprovalDeadline = approval;
        ExpectedPlanningLockDate = lockDate;

        // Keep period/deadline fields derived for downstream planning paths.
        PeriodStart = opening;
        PeriodEnd = lockDate;
        ObjectiveSettingDeadline = submission;
    }

    private CampaignStrategicObjective FindStrategicObjective(Guid objectiveId)
        => _strategicObjectives.FirstOrDefault(objective => objective.Id == objectiveId)
            ?? throw new ArgumentException("Strategic objective was not found in this campaign.", nameof(objectiveId));

    private bool HasCompletePlanningSchedule()
        => PlanningOpeningDate.HasValue
            && EmployeeSubmissionDeadline.HasValue
            && ManagerApprovalDeadline.HasValue
            && ExpectedPlanningLockDate.HasValue;

    private bool IsPlanningScheduleOrdered()
        => PlanningOpeningDate <= EmployeeSubmissionDeadline
            && EmployeeSubmissionDeadline <= ManagerApprovalDeadline
            && ManagerApprovalDeadline <= ExpectedPlanningLockDate;

    private static void EnsureOrdered(DateTime earlier, DateTime later, string paramName, string message)
    {
        if (later < earlier)
            throw new ArgumentException(message, paramName);
    }

    private void EnsureEditable()
    {
        if (!IsEditable)
            throw new DomainRuleViolationException("Only a draft campaign can be modified.");
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

/// <summary>
/// A fully-resolved participant the application layer hands to <see cref="PerformanceCycle.Launch"/>:
/// the Core identity/org snapshot plus the resolved approver (default primary manager or override).
/// </summary>
public sealed record ResolvedLaunchParticipant(
    Guid EmployeeId,
    string FullName,
    Guid ApproverEmployeeId,
    string ApproverName,
    bool IsApproverOverridden,
    string? ApproverOverrideReason,
    string? EmployeeKey = null,
    string? Email = null,
    Guid? OrgUnitId = null,
    string? OrgUnitName = null,
    string? JobTitle = null,
    Guid? ManagerId = null,
    string? ManagerName = null);
