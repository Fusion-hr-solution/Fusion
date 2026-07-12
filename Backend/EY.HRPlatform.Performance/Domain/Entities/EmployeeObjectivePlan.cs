using System.Globalization;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EmployeeObjectivePlan : AggregateRoot, ITenantEntity
{
    private readonly List<EmployeeObjective> _objectives = new();

    private EmployeeObjectivePlan() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public PlanStatus Status { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public Guid? ApproverEmployeeId { get; private set; }
    public string? ApproverName { get; private set; }
    public uint Version { get; private set; }
    public IReadOnlyCollection<EmployeeObjective> Objectives => _objectives.AsReadOnly();

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
        EnsureDraft();
        var objective = FindObjective(objectiveId);
        _objectives.Remove(objective);
        UpdatedAt = DateTime.UtcNow;
    }

    public ObjectivePlanSubmissionResult Submit(
        PerformanceCycle cycle,
        PerformanceCycleParticipant participant,
        DateTime now)
    {
        EnsureDraft();
        EnsureLaunched(cycle);
        EnsureParticipant(cycle, participant);
        EnsureEntryOpen(cycle, now);

        var reasons = ValidateForSubmission(cycle);
        if (reasons.Count > 0)
            return ObjectivePlanSubmissionResult.Blocked(reasons);

        var submittedAt = NormalizeUtc(now, nameof(now));
        Status = PlanStatus.Submitted;
        SubmittedAt = submittedAt;
        ApproverEmployeeId = participant.ApproverEmployeeId;
        ApproverName = participant.ApproverName;
        UpdatedAt = DateTime.UtcNow;
        return ObjectivePlanSubmissionResult.Success();
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
        EnsureDraft();
        EnsureLaunched(cycle);
        if (cycle.Id != CycleId)
            throw new DomainRuleViolationException("An objective plan cannot move to another campaign.");
        EnsureEntryOpen(cycle, now);
    }

    private void EnsureDraft()
    {
        if (Status != PlanStatus.Draft)
            throw new DomainRuleViolationException("Submitted objective plans are read-only.");
    }

    private static void EnsureLaunched(PerformanceCycle cycle)
    {
        if (cycle.Status != PerformanceCycleStatus.Launched)
            throw new DomainRuleViolationException("Employee objectives can only be authored for a launched campaign.");
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
