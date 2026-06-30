using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy;

public sealed class PolicyValidator
{
    /// <summary>
    /// Validates a policy draft against platform guardrails.
    /// Returns failure with a deterministic error code on the first violated rule.
    /// </summary>
    public Result Validate(TenantObjectivePolicyVersion draft, PlatformPerformanceGuardrails guardrails)
    {
        // Objective count within guardrail bounds
        if (draft.MaxObjectivesPerPlan < guardrails.MinObjectivesPerPlan)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.MaxObjectivesBelowMinimum",
                $"MaxObjectivesPerPlan ({draft.MaxObjectivesPerPlan}) is below the platform minimum ({guardrails.MinObjectivesPerPlan})."));

        if (draft.MaxObjectivesPerPlan > guardrails.MaxObjectivesPerPlan)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.MaxObjectivesAboveMaximum",
                $"MaxObjectivesPerPlan ({draft.MaxObjectivesPerPlan}) exceeds the platform maximum ({guardrails.MaxObjectivesPerPlan})."));

        // Manager validation SLA within guardrail bounds
        if (draft.ManagerValidationSlaDays < guardrails.MinManagerValidationSlaDays)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.SlaBelowMinimum",
                $"ManagerValidationSlaDays ({draft.ManagerValidationSlaDays}) is below the platform minimum ({guardrails.MinManagerValidationSlaDays})."));

        if (draft.ManagerValidationSlaDays > guardrails.MaxManagerValidationSlaDays)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.SlaAboveMaximum",
                $"ManagerValidationSlaDays ({draft.ManagerValidationSlaDays}) exceeds the platform maximum ({guardrails.MaxManagerValidationSlaDays})."));

        // Parse and validate allowed weight values
        var weightStrings = draft.AllowedWeightValues
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (weightStrings.Length == 0)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.AllowedWeightsEmpty",
                "AllowedWeightValues cannot be empty."));

        if (weightStrings.Length > guardrails.MaxAllowedWeightingValues)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.TooManyWeightValues",
                $"AllowedWeightValues has {weightStrings.Length} values but the platform maximum is {guardrails.MaxAllowedWeightingValues}."));

        var weights = new List<decimal>();
        foreach (var ws in weightStrings)
        {
            if (!decimal.TryParse(ws, out var w))
                return Result.Failure(Error.Validation(
                    "ObjectivePolicy.InvalidWeightValue",
                    $"'{ws}' is not a valid weight value."));

            if (w < 1 || w > 100)
                return Result.Failure(Error.Validation(
                    "ObjectivePolicy.WeightOutOfRange",
                    $"Weight value {w} is outside the allowed range [1, 100]."));

            // Check decimal precision
            var decimalPlaces = BitConverter.GetBytes(decimal.GetBits(w)[3])[2];
            if (decimalPlaces > guardrails.PermittedWeightDecimalPlaces)
                return Result.Failure(Error.Validation(
                    "ObjectivePolicy.WeightPrecisionExceeded",
                    $"Weight value {w} has {decimalPlaces} decimal place(s) but the platform allows {guardrails.PermittedWeightDecimalPlaces}."));

            weights.Add(w);
        }

        if (weights.Count != weights.Distinct().Count())
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.DuplicateWeightValues",
                "AllowedWeightValues contains duplicate entries."));

        // Measurement types: non-empty and within supported set
        var enabledTypes = draft.MeasurementTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (enabledTypes.Length == 0)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.MeasurementTypesEmpty",
                "At least one measurement type must be enabled."));

        var supportedTypes = guardrails.SupportedMeasurementTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var unsupported = enabledTypes.Where(t => !supportedTypes.Contains(t)).ToList();
        if (unsupported.Count > 0)
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.UnsupportedMeasurementTypes",
                $"Measurement type(s) not supported by platform guardrails: {string.Join(", ", unsupported)}."));

        // Weight feasibility: at least one combination of allowed weights sums to exactly 100
        // within MaxObjectivesPerPlan items.
        if (!CanReachOneHundred(weights, draft.MaxObjectivesPerPlan))
            return Result.Failure(Error.Validation(
                "ObjectivePolicy.WeightFeasibilityFailed",
                $"No combination of allowed weights ({draft.AllowedWeightValues}) sums to exactly 100% within {draft.MaxObjectivesPerPlan} objective(s)."));

        return Result.Success();
    }

    /// <summary>
    /// Returns true if any multiset of at most <paramref name="maxCount"/> values from
    /// <paramref name="weights"/> sums to exactly 100. Uses a BFS/DP subset-sum approach.
    /// </summary>
    private static bool CanReachOneHundred(IReadOnlyList<decimal> weights, int maxCount)
    {
        // Work in integer cents (×100) to avoid floating-point issues.
        var target = 10000; // 100.00 * 100
        var weightInts = weights.Select(w => (int)(w * 100)).ToList();

        // DP: reachable[s] = minimum count of weights used to reach sum s, or int.MaxValue if not reachable
        var reachable = new int[target + 1];
        Array.Fill(reachable, int.MaxValue);
        reachable[0] = 0;

        for (int s = 1; s <= target; s++)
        {
            foreach (var w in weightInts)
            {
                if (w > s) continue;
                if (reachable[s - w] == int.MaxValue) continue;
                var candidate = reachable[s - w] + 1;
                if (candidate <= maxCount && candidate < reachable[s])
                    reachable[s] = candidate;
            }
        }

        return reachable[target] != int.MaxValue && reachable[target] <= maxCount;
    }
}
