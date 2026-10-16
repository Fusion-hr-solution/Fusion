using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Ai;

/// <summary>
/// Whether Performance AI may run for the current tenant right now: the tenant switch is on (a tenant
/// whose settings were never saved is on by default) and the provider is configured and not resting.
/// The workspace context reports it; every AI endpoint checks it again before calling out.
/// </summary>
public static class PerformanceAiAccess
{
    public static async Task<bool> IsAvailableAsync(PerformanceDbContext db, IPerformanceAiProvider ai, CancellationToken cancellationToken)
    {
        if (!ai.IsAvailable) return false;
        var enabled = await db.CycleSettings.AsNoTracking()
            .Select(settings => (bool?)settings.AiAssistanceEnabled)
            .FirstOrDefaultAsync(cancellationToken);
        return enabled ?? true;
    }
}
