using EY.HRPlatform.Performance.Domain.Entities.Platform;

namespace EY.HRPlatform.Performance.Features.PlatformDefaults;

public sealed record GuardrailImpactResult(
    bool HasConflicts,
    int AffectedTenantCount,
    string ConflictSummary);

public interface IGuardrailImpactAnalyzer
{
    Task<GuardrailImpactResult> AnalyzeAsync(
        PlatformPerformanceGuardrails proposedGuardrails,
        CancellationToken cancellationToken);
}
