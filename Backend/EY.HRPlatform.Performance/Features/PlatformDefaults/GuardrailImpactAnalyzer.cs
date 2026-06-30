using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults;

/// <summary>
/// Analyzes whether publishing proposed guardrails would violate any active tenant policies.
/// Returns aggregated impact: affected tenant count + representative conflict reasons.
/// Does NOT expose tenant business data — only conflicting guardrail fields and counts.
/// </summary>
public sealed class GuardrailImpactAnalyzer(PerformanceDbContext db) : IGuardrailImpactAnalyzer
{
    public async Task<GuardrailImpactResult> AnalyzeAsync(
        PlatformPerformanceGuardrails proposed,
        CancellationToken cancellationToken)
    {
        // Query all active policy versions across all tenants (bypass tenant filter — platform view).
        var activePolicies = await db.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .Where(v => v.Status == PolicyVersionStatus.Active)
            .Select(v => new
            {
                v.TenantId,
                v.MaxObjectivesPerPlan,
                v.ManagerValidationSlaDays,
                v.AllowedWeightValues,
                v.MeasurementTypes,
            })
            .ToListAsync(cancellationToken);

        var supportedMeasurements = proposed.SupportedMeasurementTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var conflictReasons = new HashSet<string>();
        var affectedTenants = new HashSet<Guid>();

        foreach (var policy in activePolicies)
        {
            var reasons = new List<string>();

            if (policy.MaxObjectivesPerPlan < proposed.MinObjectivesPerPlan)
                reasons.Add($"MaxObjectivesPerPlan={policy.MaxObjectivesPerPlan} < minimum {proposed.MinObjectivesPerPlan}");

            if (policy.MaxObjectivesPerPlan > proposed.MaxObjectivesPerPlan)
                reasons.Add($"MaxObjectivesPerPlan={policy.MaxObjectivesPerPlan} > maximum {proposed.MaxObjectivesPerPlan}");

            if (policy.ManagerValidationSlaDays < proposed.MinManagerValidationSlaDays)
                reasons.Add($"ManagerValidationSlaDays={policy.ManagerValidationSlaDays} < minimum {proposed.MinManagerValidationSlaDays}");

            if (policy.ManagerValidationSlaDays > proposed.MaxManagerValidationSlaDays)
                reasons.Add($"ManagerValidationSlaDays={policy.ManagerValidationSlaDays} > maximum {proposed.MaxManagerValidationSlaDays}");

            var policyMeasurements = policy.MeasurementTypes
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var unsupportedMeasurements = policyMeasurements
                .Where(m => !supportedMeasurements.Contains(m))
                .ToList();
            if (unsupportedMeasurements.Count > 0)
                reasons.Add($"Measurement types not supported: {string.Join(", ", unsupportedMeasurements)}");

            if (reasons.Count > 0)
            {
                affectedTenants.Add(policy.TenantId);
                foreach (var r in reasons)
                    conflictReasons.Add(r);
            }
        }

        if (affectedTenants.Count == 0)
            return new GuardrailImpactResult(false, 0, string.Empty);

        var summary = $"{affectedTenants.Count} tenant(s) affected: {string.Join("; ", conflictReasons.Take(5))}";
        return new GuardrailImpactResult(true, affectedTenants.Count, summary);
    }
}
