using System.Globalization;
using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives;

internal static class EmployeeObjectivePlanRules
{
    public static IReadOnlyList<int> AllowedWeights(PerformanceCycle cycle)
    {
        var raw = cycle.PlanningRulesSnapshot?.AllowedWeightMenu ?? string.Empty;
        return raw.Replace("[", string.Empty, StringComparison.Ordinal)
            .Replace("]", string.Empty, StringComparison.Ordinal)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => decimal.TryParse(token, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
                ? value <= 1m ? (int)Math.Round(value * 100m) : (int)Math.Round(value)
                : (int?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .OrderBy(value => value)
            .ToList();
    }

    public static IReadOnlyList<string> EnabledMeasurementMethods(PerformanceCycle cycle)
        => CampaignTeamObjective.ParseEnabledMeasurementMethods(cycle);

    public static bool IsEntryOpen(PerformanceCycle cycle, DateTime now)
        => cycle.PlanningOpeningDate.HasValue && NormalizeUtc(now) >= cycle.PlanningOpeningDate.Value;

    public static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
