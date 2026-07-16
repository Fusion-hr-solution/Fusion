using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy;

public sealed class PerformanceConfigurationValidator
{
    private const int MaxWeightChoices = 10;

    public IReadOnlyList<string> ValidatePlatform(ApplyPlatformPerformanceConfigurationRequest request)
    {
        var errors = new List<string>();
        var supportedWeights = ParseWeights(request.SupportedAllowedWeights);
        var startingWeights = ParseWeights(request.StartingAllowedWeights);

        if (request.MaxObjectiveCountLimit < 1)
            errors.Add("Maximum objective count must be at least 1.");
        if (supportedWeights.Count == 0)
            errors.Add("At least one supported weight is required.");
        errors.AddRange(ValidateWeightMenu(request.SupportedAllowedWeights, "Supported objective weights"));
        if (supportedWeights.Count > MaxWeightChoices)
            errors.Add($"Supported objective weights must use no more than {MaxWeightChoices} choices.");
        if (!request.QuantitativeAvailable && !request.QualitativeAvailable)
            errors.Add("At least one measurement method must be available.");
        if (request.StartingMaxObjectiveCount < 1 || request.StartingMaxObjectiveCount > request.MaxObjectiveCountLimit)
            errors.Add("Starting maximum objective count must be within the platform limit.");
        if (startingWeights.Count == 0)
            errors.Add("Starting allowed weights are required.");
        errors.AddRange(ValidateWeightMenu(request.StartingAllowedWeights, "Starting allowed weights"));
        if (startingWeights.Count > MaxWeightChoices)
            errors.Add($"Starting allowed weights must use no more than {MaxWeightChoices} choices.");
        if (!startingWeights.All(supportedWeights.Contains))
            errors.Add("Starting allowed weights must come from the platform-supported weights.");
        if (!request.StartingQuantitativeEnabled && !request.StartingQualitativeEnabled)
            errors.Add("At least one starting measurement method must be enabled.");
        if (request.StartingQuantitativeEnabled && !request.QuantitativeAvailable)
            errors.Add("Starting Quantitative measurement cannot be enabled when the platform does not support it.");
        if (request.StartingQualitativeEnabled && !request.QualitativeAvailable)
            errors.Add("Starting Qualitative measurement cannot be enabled when the platform does not support it.");
        if (startingWeights.Count > 0 && request.StartingMaxObjectiveCount > 0 &&
            !CanReachOneHundred(startingWeights, request.StartingMaxObjectiveCount))
            errors.Add("Starting allowed weights must be able to produce a 100% plan within the starting maximum objective count.");

        return errors;
    }

    public IReadOnlyList<string> ValidateTenant(
        ValidateObjectivePlanningConfigurationRequest request,
        PlatformPerformanceGuardrails? platformConfiguration)
    {
        if (platformConfiguration is null)
            return ["Platform performance configuration must be applied before tenant configuration can be changed."];

        var errors = new List<string>();
        var tenantWeights = ParseWeights(request.AllowedWeights);
        var supportedWeights = ParseWeights(platformConfiguration.SupportedAllowedWeightValues);

        if (request.MaxObjectiveCount < 1)
            errors.Add("Maximum objective count must be at least 1.");
        if (request.MaxObjectiveCount > platformConfiguration.MaxObjectivesPerPlan)
            errors.Add("Tenant maximum objective count must stay within the platform maximum objective count.");
        if (tenantWeights.Count == 0)
            errors.Add("At least one allowed weight is required.");
        errors.AddRange(ValidateWeightMenu(request.AllowedWeights, "Allowed weights"));
        if (tenantWeights.Count > MaxWeightChoices)
            errors.Add($"Allowed weights must use no more than {MaxWeightChoices} choices.");
        if (!tenantWeights.All(supportedWeights.Contains))
            errors.Add("Tenant allowed weights must come from platform-supported weights.");
        if (!request.QuantitativeEnabled && !request.QualitativeEnabled)
            errors.Add("At least one measurement method must be enabled.");
        if (request.QuantitativeEnabled && !platformConfiguration.QuantitativeAvailable)
            errors.Add("Quantitative measurement is not available for this tenant.");
        if (request.QualitativeEnabled && !platformConfiguration.QualitativeAvailable)
            errors.Add("Qualitative measurement is not available for this tenant.");
        if (tenantWeights.Count > 0 && request.MaxObjectiveCount > 0 &&
            !CanReachOneHundred(tenantWeights, request.MaxObjectiveCount))
            errors.Add("Allowed weights must be able to produce a 100% plan within the maximum objective count.");

        return errors;
    }

    public static string ToMeasurementTypes(bool quantitative, bool qualitative)
    {
        var methods = new List<string>();
        if (quantitative) methods.Add("Quantitative");
        if (qualitative) methods.Add("Qualitative");
        return string.Join(",", methods);
    }

    public static (bool Quantitative, bool Qualitative) FromMeasurementTypes(string measurementTypes)
        => (
            measurementTypes.Contains("Quantitative", StringComparison.OrdinalIgnoreCase),
            measurementTypes.Contains("Qualitative", StringComparison.OrdinalIgnoreCase));

    public static string NormalizeWeights(string values)
        => string.Join(",", ParseWeights(values));

    private static IReadOnlyList<int> ParseWeights(string values)
        => values.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(v => int.TryParse(v, out var parsed) ? parsed : -1)
            .Where(v => v is > 0 and <= 100)
            .Distinct()
            .Order()
            .ToList();

    private static IReadOnlyList<string> ValidateWeightMenu(string values, string label)
    {
        var errors = new List<string>();
        var tokens = values.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var parsed = new List<int>();

        foreach (var token in tokens)
        {
            if (!int.TryParse(token, out var weight) || weight is < 1 or > 100)
            {
                errors.Add($"{label} must be whole percentages from 1% to 100%.");
                continue;
            }

            if (weight % 5 != 0)
                errors.Add($"{label} must use 5% increments.");

            parsed.Add(weight);
        }

        if (parsed.Count != parsed.Distinct().Count())
            errors.Add($"{label} cannot contain duplicate values.");

        return errors.Distinct().ToList();
    }

    private static bool CanReachOneHundred(IReadOnlyList<int> weights, int maxCount)
    {
        const int target = 100;
        var reachable = new int[target + 1];
        Array.Fill(reachable, int.MaxValue);
        reachable[0] = 0;

        for (var sum = 1; sum <= target; sum++)
        {
            foreach (var weight in weights)
            {
                if (weight > sum || reachable[sum - weight] == int.MaxValue)
                    continue;

                var candidate = reachable[sum - weight] + 1;
                if (candidate <= maxCount && candidate < reachable[sum])
                    reachable[sum] = candidate;
            }
        }

        return reachable[target] != int.MaxValue && reachable[target] <= maxCount;
    }
}
