using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Domain.Entities.Platform;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults;

public sealed record GuardrailImpactResult(
    bool HasConflicts,
    int AffectedTenantPolicyCount,
    IReadOnlyList<GuardrailImpactReasonDto> TenantPolicyConflicts,
    IReadOnlyList<string> StandardSetupConflicts)
{
    public string ToConflictSummary()
    {
        var parts = new List<string>();

        if (AffectedTenantPolicyCount > 0)
        {
            parts.Add(
                $"{AffectedTenantPolicyCount} active tenant polic{(AffectedTenantPolicyCount == 1 ? "y" : "ies")} would fall outside the proposed limits");
        }

        if (StandardSetupConflicts.Count > 0)
            parts.Add("the current standard setup would no longer be valid");

        var details = TenantPolicyConflicts
            .Select(conflict => $"{conflict.Reason} ({conflict.AffectedCount})")
            .Concat(StandardSetupConflicts)
            .Take(5)
            .ToList();

        return details.Count == 0
            ? string.Join("; ", parts)
            : $"{string.Join("; ", parts)}. {string.Join("; ", details)}";
    }
}

public interface IGuardrailImpactAnalyzer
{
    Task<GuardrailImpactResult> AnalyzeAsync(
        PlatformPerformanceGuardrails proposedGuardrails,
        CancellationToken cancellationToken);
}
