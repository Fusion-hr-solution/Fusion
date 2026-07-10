using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A manager-owned team objective translating a launched campaign's strategy for the
/// manager's frozen campaign scope. Its own aggregate root: authored after launch,
/// concurrently by many managers, outside the Draft-gated campaign aggregate.
/// No lifecycle, no approval, no weight — a saved team objective is part of the cascade;
/// employee usage is governed solely by the campaign schedule.
/// </summary>
public sealed class CampaignTeamObjective : AggregateRoot, ITenantEntity
{
    public const int TitleMaxLength = 200;
    public const int SuccessCriteriaMaxLength = 500;
    public const int MeasurementMethodMaxLength = 50;
    public const int DescriptionMaxLength = 2000;
    public const int OwnerManagerNameMaxLength = 256;

    private CampaignTeamObjective() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid StrategicObjectiveId { get; private set; }

    /// <summary>The frozen approver who authored this objective. Immutable after creation.</summary>
    public Guid OwnerManagerEmployeeId { get; private set; }

    /// <summary>Display snapshot of the owning manager's name, stable against later Core changes.</summary>
    public string OwnerManagerName { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;
    public string SuccessCriteria { get; private set; } = string.Empty;
    public string MeasurementMethod { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    /// <summary>Row version for optimistic concurrency control (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public static CampaignTeamObjective Create(
        PerformanceCycle cycle,
        CampaignStrategicObjective strategicObjective,
        Guid ownerManagerEmployeeId,
        string ownerManagerName,
        string title,
        string successCriteria,
        string measurementMethod,
        string? description)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        EnsureLaunched(cycle);

        if (ownerManagerEmployeeId == Guid.Empty)
            throw new ArgumentException("An owning manager is required.", nameof(ownerManagerEmployeeId));

        var objective = new CampaignTeamObjective
        {
            Id = Guid.NewGuid(),
            TenantId = cycle.TenantId,
            CycleId = cycle.Id,
            OwnerManagerEmployeeId = ownerManagerEmployeeId,
            OwnerManagerName = NormalizeRequired(ownerManagerName, nameof(ownerManagerName), OwnerManagerNameMaxLength)
        };

        objective.Apply(cycle, strategicObjective, title, successCriteria, measurementMethod, description);
        return objective;
    }

    public void Update(
        PerformanceCycle cycle,
        CampaignStrategicObjective strategicObjective,
        string title,
        string successCriteria,
        string measurementMethod,
        string? description)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        EnsureLaunched(cycle);

        if (cycle.Id != CycleId)
            throw new DomainRuleViolationException("A team objective cannot move to another campaign.");

        Apply(cycle, strategicObjective, title, successCriteria, measurementMethod, description);
        UpdatedAt = DateTime.UtcNow;
    }

    private void Apply(
        PerformanceCycle cycle,
        CampaignStrategicObjective strategicObjective,
        string title,
        string successCriteria,
        string measurementMethod,
        string? description)
    {
        ArgumentNullException.ThrowIfNull(strategicObjective);

        if (strategicObjective.CycleId != cycle.Id)
            throw new DomainRuleViolationException(
                "A team objective must link to a strategic objective of the same campaign.");
        if (!strategicObjective.IsActive)
            throw new DomainRuleViolationException(
                "A team objective must link to an active strategic objective.");

        StrategicObjectiveId = strategicObjective.Id;
        Title = NormalizeRequired(title, nameof(title), TitleMaxLength);
        SuccessCriteria = NormalizeRequired(successCriteria, nameof(successCriteria), SuccessCriteriaMaxLength);
        MeasurementMethod = ResolveMeasurementMethod(cycle, measurementMethod);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
    }

    /// <summary>
    /// Validates the requested measurement method against the campaign's frozen planning-rules
    /// snapshot and returns the snapshot's canonical token.
    /// </summary>
    private static string ResolveMeasurementMethod(PerformanceCycle cycle, string measurementMethod)
    {
        if (string.IsNullOrWhiteSpace(measurementMethod))
            throw new ArgumentException("measurementMethod is required.", nameof(measurementMethod));

        var requested = measurementMethod.Trim();
        var enabled = ParseEnabledMeasurementMethods(cycle);
        var canonical = enabled.FirstOrDefault(
            method => string.Equals(method, requested, StringComparison.OrdinalIgnoreCase));

        return canonical ?? throw new DomainRuleViolationException(
            $"Measurement method '{requested}' is not enabled for this campaign.");
    }

    public static IReadOnlyList<string> ParseEnabledMeasurementMethods(PerformanceCycle cycle)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        return (cycle.PlanningRulesSnapshot?.EnabledMeasurementMethods ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();
    }

    private static void EnsureLaunched(PerformanceCycle cycle)
    {
        if (cycle.Status != PerformanceCycleStatus.Launched)
            throw new DomainRuleViolationException(
                "Team objectives can only be authored in a launched campaign.");
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} is required.", paramName);

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
