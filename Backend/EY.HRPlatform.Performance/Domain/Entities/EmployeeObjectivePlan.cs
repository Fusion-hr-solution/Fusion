using System.Globalization;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EmployeeObjectivePlan : AggregateRoot, ITenantEntity
{
    private readonly List<EmployeeObjective> _objectives = new();
    private readonly List<EmployeeObjectivePlanReviewEvent> _reviewEvents = new();

    private EmployeeObjectivePlan() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public PlanStatus Status { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public Guid? ApproverEmployeeId { get; private set; }
    public string? ApproverName { get; private set; }
    public Guid? ApprovingManagerEmployeeId { get; private set; }
    public string? ApprovingManagerName { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public uint Version { get; private set; }
    public IReadOnlyCollection<EmployeeObjective> Objectives => _objectives.AsReadOnly();
    public IReadOnlyCollection<EmployeeObjectivePlanReviewEvent> ReviewEvents => _reviewEvents.AsReadOnly();
    public string? LastChangeRequestComment => _reviewEvents
        .Where(item => item.Type == ReviewEventType.ChangesRequested)
        .OrderByDescending(item => item.OccurredAt)
        .Select(item => item.Comment)
        .FirstOrDefault();

    public static EmployeeObjectivePlan CreateDraft(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        DateTime now)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        ArgumentNullException.ThrowIfNull(participant);
        EnsureLaunched(cycle);
        EnsureParticipant(cycle, participant);
        EnsureEntryOpen(cycle, now);

        return new EmployeeObjectivePlan
        {
            Id = Guid.NewGuid(),
            TenantId = cycle.TenantId,
            CycleId = cycle.Id,
            EmployeeId = participant.EmployeeId,
            Status = PlanStatus.Draft
        };
    }

    public EmployeeObjective AddObjective(
        PerformanceCycle cycle,
        string title,
        ObjectiveAlignmentType? alignmentType,
        Guid? alignmentTargetId,
        string? alignmentTitle,
        int? weight,
        DateTime? deadline,
        string? measurementMethod,
        string? measurementIndicator,
        string? targetValue,
        string? targetUnit,
        DateTime now,
        string? description = null,
        string? successCriteria = null)
    {
        EnsureCanMutate(cycle, now);
        if (_objectives.Count >= cycle.PlanningRulesSnapshot!.MaxObjectiveCount)
            throw new DomainRuleViolationException(
                $"This campaign allows up to {cycle.PlanningRulesSnapshot.MaxObjectiveCount} objectives.");

        ValidateWeight(cycle, weight);
        var canonicalMethod = ResolveMeasurementMethod(cycle, measurementMethod);
        var objective = EmployeeObjective.Create(
            Id,
            title,
            description,
            alignmentType,
            alignmentTargetId,
            alignmentTitle,
            weight,
            deadline,
            canonicalMethod,
            measurementIndicator,
            targetValue,
            targetUnit,
            successCriteria);
        _objectives.Add(objective);
        UpdatedAt = DateTime.UtcNow;
        return objective;
    }

    public void UpdateObjective(
        PerformanceCycle cycle,
        Guid objectiveId,
        string title,
        ObjectiveAlignmentType? alignmentType,
        Guid? alignmentTargetId,
        string? alignmentTitle,
        int? weight,
        DateTime? deadline,
        string? measurementMethod,
        string? measurementIndicator,
        string? targetValue,
        string? targetUnit,
        DateTime now,
        string? description = null,
        string? successCriteria = null)
    {
        EnsureCanMutate(cycle, now);
        ValidateWeight(cycle, weight);
        var canonicalMethod = ResolveMeasurementMethod(cycle, measurementMethod);
        FindObjective(objectiveId).Update(
            title,
            description,
            alignmentType,
            alignmentTargetId,
            alignmentTitle,
            weight,
            deadline,
            canonicalMethod,
            measurementIndicator,
            targetValue,
            targetUnit,
            successCriteria);
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveObjective(Guid objectiveId, DateTime now)
    {
        EnsureEditable();
        var objective = FindObjective(objectiveId);
        _objectives.Remove(objective);
        UpdatedAt = DateTime.UtcNow;
    }

    public ObjectivePlanSubmissionResult Submit(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        DateTime now)
    {
        EnsureEditable();
        EnsureLaunched(cycle);
        EnsureParticipant(cycle, participant);
        EnsureEntryOpen(cycle, now);

        var reasons = ValidateForSubmission(cycle);
        if (reasons.Count > 0)
            return ObjectivePlanSubmissionResult.Blocked(reasons);

        var submittedAt = NormalizeUtc(now, nameof(now));
        var eventType = Status == PlanStatus.ChangesRequested ? ReviewEventType.Resubmitted : ReviewEventType.Submitted;
        Status = PlanStatus.Submitted;
        SubmittedAt = submittedAt;
        ApproverEmployeeId = participant.ApproverEmployeeId;
        ApproverName = participant.ApproverName;
        AppendReviewEvent(
            new EmployeeObjectivePlanReviewActor(EmployeeId, participant.FullName),
            eventType,
            submittedAt);
        UpdatedAt = DateTime.UtcNow;
        AddDomainEvent(new Events.EmployeeObjectivePlanSubmittedEvent(
            TenantId,
            Id,
            CycleId,
            EmployeeId,
            participant.FullName,
            participant.ApproverEmployeeId,
            eventType == ReviewEventType.Resubmitted));
        return ObjectivePlanSubmissionResult.Success();
    }

    public void RequestChanges(
        EmployeeObjectivePlanReviewActor actor,
        string comment,
        DateTime now,
        IReadOnlyCollection<Guid>? referencedObjectiveIds = null)
    {
        ArgumentNullException.ThrowIfNull(actor);
        EnsureSubmitted();

        if (string.IsNullOrWhiteSpace(comment))
            throw new DomainRuleViolationException("A change-request comment is required.");

        var references = NormalizeObjectiveReferences(referencedObjectiveIds);
        var occurredAt = NormalizeUtc(now, nameof(now));
        var reviewEvent = EmployeeObjectivePlanReviewEvent.Create(
            Id,
            actor,
            ReviewEventType.ChangesRequested,
            occurredAt,
            comment,
            references);
        Status = PlanStatus.ChangesRequested;
        _reviewEvents.Add(reviewEvent);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(EmployeeObjectivePlanReviewActor actor, DateTime now, string? note = null)
    {
        ArgumentNullException.ThrowIfNull(actor);
        EnsureSubmitted();

        var approvedAt = NormalizeUtc(now, nameof(now));
        var reviewEvent = EmployeeObjectivePlanReviewEvent.Create(Id, actor, ReviewEventType.Approved, approvedAt, note);
        Status = PlanStatus.Approved;
        ApprovingManagerEmployeeId = actor.EmployeeId;
        ApprovingManagerName = actor.Name.Trim();
        ApprovedAt = approvedAt;
        _reviewEvents.Add(reviewEvent);
        UpdatedAt = DateTime.UtcNow;
        AddDomainEvent(new Events.EmployeeObjectivePlanApprovedEvent(
            TenantId,
            Id,
            CycleId,
            EmployeeId,
            actor.EmployeeId,
            actor.Name.Trim()));
    }

    private List<ObjectivePlanBlockingReason> ValidateForSubmission(PerformanceCycle cycle)
    {
        var reasons = new List<ObjectivePlanBlockingReason>();
        var snapshot = cycle.PlanningRulesSnapshot!;

        if (_objectives.Count == 0)
            reasons.Add(new ObjectivePlanBlockingReason("Plan.Empty", "Add at least one objective before submitting."));
        if (_objectives.Count > snapshot.MaxObjectiveCount)
            reasons.Add(new ObjectivePlanBlockingReason("Plan.TooManyObjectives", $"This campaign allows up to {snapshot.MaxObjectiveCount} objectives."));

        var total = _objectives.Sum(objective => objective.Weight ?? 0);
        if (total != 100)
            reasons.Add(new ObjectivePlanBlockingReason("Weight.TotalMustEqual100", $"Your objective weights total {total}%."));

        foreach (var objective in _objectives)
        {
            if (!objective.HasAlignment)
                reasons.Add(new ObjectivePlanBlockingReason("Objective.AlignmentRequired", "Every objective needs an alignment target.", objective.Id));
            if (!objective.Weight.HasValue)
                reasons.Add(new ObjectivePlanBlockingReason("Objective.WeightRequired", "Every objective needs an importance weight.", objective.Id));
            else if (!ParseAllowedWeights(cycle).Contains(objective.Weight.Value))
                reasons.Add(new ObjectivePlanBlockingReason("Objective.WeightNotAllowed", "Choose an allowed importance weight.", objective.Id));
            if (!objective.Deadline.HasValue)
                reasons.Add(new ObjectivePlanBlockingReason("Objective.DeadlineRequired", "Every objective needs a target date.", objective.Id));
            if (string.IsNullOrWhiteSpace(objective.MeasurementMethod))
                reasons.Add(new ObjectivePlanBlockingReason("Objective.MeasurementMethodRequired", "Every objective needs a measurement method.", objective.Id));
            else if (!CampaignTeamObjective.ParseEnabledMeasurementMethods(cycle).Contains(objective.MeasurementMethod, StringComparer.OrdinalIgnoreCase))
                reasons.Add(new ObjectivePlanBlockingReason("Objective.MeasurementMethodNotAllowed", "Choose an enabled measurement method.", objective.Id));

            if (string.Equals(objective.MeasurementMethod, "Quantitative", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(objective.MeasurementIndicator))
                    reasons.Add(new ObjectivePlanBlockingReason("Objective.MeasurementIndicatorRequired", "Quantitative objectives need an indicator.", objective.Id));
                if (string.IsNullOrWhiteSpace(objective.TargetValue))
                    reasons.Add(new ObjectivePlanBlockingReason("Objective.TargetValueRequired", "Quantitative objectives need a target value.", objective.Id));
            }
            else if (string.Equals(objective.MeasurementMethod, "Qualitative", StringComparison.OrdinalIgnoreCase)
                     && string.IsNullOrWhiteSpace(objective.SuccessCriteria))
            {
                reasons.Add(new ObjectivePlanBlockingReason("Objective.SuccessCriteriaRequired", "Qualitative objectives need success criteria.", objective.Id));
            }
        }

        return reasons;
    }

    private void EnsureCanMutate(PerformanceCycle cycle, DateTime now)
    {
        EnsureEditable();
        EnsureLaunched(cycle);
        if (cycle.Id != CycleId)
            throw new DomainRuleViolationException("An objective plan cannot move to another campaign.");
        EnsureEntryOpen(cycle, now);
    }

    private void EnsureEditable()
    {
        if (Status is not (PlanStatus.Draft or PlanStatus.ChangesRequested))
            throw new DomainRuleViolationException("This objective plan is read-only.");
    }

    private void EnsureSubmitted()
    {
        if (Status != PlanStatus.Submitted)
            throw new DomainRuleViolationException("Only submitted objective plans can be reviewed.");
    }

    private void AppendReviewEvent(
        EmployeeObjectivePlanReviewActor actor,
        ReviewEventType type,
        DateTime occurredAt,
        string? comment = null)
    {
        _reviewEvents.Add(EmployeeObjectivePlanReviewEvent.Create(Id, actor, type, occurredAt, comment));
    }

    private static void EnsureLaunched(PerformanceCycle cycle)
    {
        if (cycle.Status != PerformanceCycleStatus.Launched)
            throw new DomainRuleViolationException("Employee objectives can only be authored for a launched campaign.");
        if (cycle.IsPlanningLocked)
            throw new DomainRuleViolationException("Planning is locked for this campaign.");
        if (cycle.PlanningRulesSnapshot is null)
            throw new DomainRuleViolationException("Campaign planning rules are required.");
    }

    private static void EnsureEntryOpen(PerformanceCycle cycle, DateTime now)
    {
        var at = NormalizeUtc(now, nameof(now));
        if (!cycle.PlanningOpeningDate.HasValue || at < cycle.PlanningOpeningDate.Value)
            throw new DomainRuleViolationException("Objective planning is not open yet.");
    }

    private static void EnsureParticipant(PerformanceCycle cycle, PerformanceCycleParticipant participant)
    {
        if (participant.TenantId != cycle.TenantId || participant.CycleId != cycle.Id)
            throw new DomainRuleViolationException("Objective plan access must come from the campaign participant baseline.");
    }

    private EmployeeObjective FindObjective(Guid objectiveId)
        => _objectives.FirstOrDefault(objective => objective.Id == objectiveId)
           ?? throw new ArgumentException("Objective was not found in this plan.", nameof(objectiveId));

    private Guid[] NormalizeObjectiveReferences(IReadOnlyCollection<Guid>? referencedObjectiveIds)
    {
        if (referencedObjectiveIds is null || referencedObjectiveIds.Count == 0)
            return [];

        var objectiveIds = _objectives.Select(objective => objective.Id).ToHashSet();
        var references = referencedObjectiveIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

        if (references.Any(id => !objectiveIds.Contains(id)))
            throw new DomainRuleViolationException("Change-request references must belong to this objective plan.");

        return references;
    }

    private static void ValidateWeight(PerformanceCycle cycle, int? weight)
    {
        if (!weight.HasValue)
            return;
        if (!ParseAllowedWeights(cycle).Contains(weight.Value))
            throw new DomainRuleViolationException($"Weight '{weight.Value}' is not available for this campaign.");
    }

    private static string? ResolveMeasurementMethod(PerformanceCycle cycle, string? measurementMethod)
    {
        if (string.IsNullOrWhiteSpace(measurementMethod))
            return null;

        var requested = measurementMethod.Trim();
        var canonical = CampaignTeamObjective.ParseEnabledMeasurementMethods(cycle)
            .FirstOrDefault(method => string.Equals(method, requested, StringComparison.OrdinalIgnoreCase));

        return canonical ?? throw new DomainRuleViolationException(
            $"Measurement method '{requested}' is not enabled for this campaign.");
    }

    private static IReadOnlySet<int> ParseAllowedWeights(PerformanceCycle cycle)
    {
        var raw = cycle.PlanningRulesSnapshot?.AllowedWeightMenu ?? string.Empty;
        var tokens = raw.Replace("[", string.Empty, StringComparison.Ordinal)
            .Replace("]", string.Empty, StringComparison.Ordinal)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return tokens
            .Select(token => decimal.TryParse(token, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
                ? value <= 1m ? (int)Math.Round(value * 100m) : (int)Math.Round(value)
                : (int?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToHashSet();
    }

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

public sealed record ObjectivePlanBlockingReason(string Code, string Message, Guid? ObjectiveId = null);

public sealed record ObjectivePlanSubmissionResult(bool Succeeded, IReadOnlyList<ObjectivePlanBlockingReason> BlockingReasons)
{
    public static ObjectivePlanSubmissionResult Success() => new(true, []);

    public static ObjectivePlanSubmissionResult Blocked(IReadOnlyList<ObjectivePlanBlockingReason> reasons)
        => new(false, reasons);
}
