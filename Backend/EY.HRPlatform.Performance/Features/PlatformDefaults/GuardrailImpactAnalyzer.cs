using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Entities.Platform;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults;

/// <summary>
/// Analyzes whether applying proposed guardrails would violate any active tenant policies.
/// Returns aggregated impact: affected tenant count + representative conflict reasons.
/// Does NOT expose tenant business data — only conflicting guardrail fields and counts.
/// </summary>
public sealed class GuardrailImpactAnalyzer(
    PerformanceDbContext db,
    PolicyValidator validator) : IGuardrailImpactAnalyzer
{
    public async Task<GuardrailImpactResult> AnalyzeAsync(
        PlatformPerformanceGuardrails proposed,
        CancellationToken cancellationToken)
    {
        var activePolicies = await db.TenantObjectivePolicyVersions
            .IgnoreQueryFilters()
            .Where(v => v.Status == PolicyVersionStatus.Active)
            .ToListAsync(cancellationToken);

        var conflictCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var affectedTenantPolicies = 0;

        foreach (var policy in activePolicies)
        {
            var validation = validator.Validate(policy, proposed);
            if (validation.IsFailure)
            {
                affectedTenantPolicies++;
                conflictCounts[validation.Error.Message] =
                    conflictCounts.TryGetValue(validation.Error.Message, out var count)
                        ? count + 1
                        : 1;
            }
        }

        var standardSetupConflicts = new List<string>();
        var baseline = await db.PlatformObjectiveBaselines
            .AsNoTracking()
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline?.PublishedVersion is { } publishedBaseline)
        {
            var validationCandidate = TenantObjectivePolicyVersion.CreateApplied(
                Guid.NewGuid(),
                Guid.NewGuid(),
                publishedBaseline.VersionNumber,
                publishedBaseline.MaxObjectivesPerPlan,
                publishedBaseline.AllowedWeightValues,
                publishedBaseline.ManagerValidationSlaDays,
                publishedBaseline.CascadeMode,
                publishedBaseline.MeasurementTypes,
                publishedBaseline.AttachmentsEnabled,
                Guid.NewGuid(),
                "Platform standard setup",
                null,
                publishedBaseline.Id);

            var baselineValidation = validator.Validate(validationCandidate, proposed);
            if (baselineValidation.IsFailure)
                standardSetupConflicts.Add(baselineValidation.Error.Message);
        }

        var tenantPolicyConflicts = conflictCounts
            .OrderByDescending(item => item.Value)
            .ThenBy(item => item.Key, StringComparer.Ordinal)
            .Select(item => new GuardrailImpactReasonDto(item.Key, item.Value))
            .ToList();

        var hasConflicts = affectedTenantPolicies > 0 || standardSetupConflicts.Count > 0;
        return new GuardrailImpactResult(
            hasConflicts,
            affectedTenantPolicies,
            tenantPolicyConflicts,
            standardSetupConflicts);
    }
}
