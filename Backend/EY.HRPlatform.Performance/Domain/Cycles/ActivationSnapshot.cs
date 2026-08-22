using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Cycles;

/// <summary>
/// The frozen configuration captured when a Cycle activates. It preserves the Cycle name and
/// dates, planning deadline, effective Cycle-related settings, the population-selection rule,
/// the confirmed roster, and the published strategy with accountable owners — as captured
/// values, not live references. Later tenant-setting changes never mutate it. One per Cycle.
/// <para>
/// The roster, strategy, settings, and population-rule payloads are stored as captured JSON
/// so the snapshot is a true point-in-time value that cannot drift with live Core or tenant
/// data. Structured access is through the read model, never by mutating these fields.
/// </para>
/// </summary>
public sealed class ActivationSnapshot : PerformanceChildEntity
{
    private ActivationSnapshot() { }

    public Guid CycleId { get; private set; }
    public DateTime CapturedAt { get; private set; }

    public string CycleName { get; private set; } = string.Empty;
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public DateOnly PlanningDeadline { get; private set; }
    public DateOnly EligibilityDate { get; private set; }
    public int ConfirmedParticipantCount { get; private set; }

    public string SettingsJson { get; private set; } = "{}";
    public string PopulationRuleJson { get; private set; } = "{}";
    public string RosterJson { get; private set; } = "[]";
    public string StrategyJson { get; private set; } = "[]";

    public static ActivationSnapshot Capture(
        Guid tenantId,
        Guid cycleId,
        string cycleName,
        DateOnly startDate,
        DateOnly endDate,
        DateOnly planningDeadline,
        DateOnly eligibilityDate,
        int confirmedParticipantCount,
        string settingsJson,
        string populationRuleJson,
        string rosterJson,
        string strategyJson)
        => new()
        {
            TenantId = tenantId,
            CycleId = cycleId,
            CapturedAt = DateTime.UtcNow,
            CycleName = cycleName,
            StartDate = startDate,
            EndDate = endDate,
            PlanningDeadline = planningDeadline,
            EligibilityDate = eligibilityDate,
            ConfirmedParticipantCount = confirmedParticipantCount,
            SettingsJson = settingsJson,
            PopulationRuleJson = populationRuleJson,
            RosterJson = rosterJson,
            StrategyJson = strategyJson,
        };
}
