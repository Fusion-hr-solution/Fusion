using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// Idempotently seeds the platform performance configuration for a fresh system. It creates
/// only missing platform-supported limits and starting tenant configuration; it never overwrites
/// admin-authored data and never mutates tenant configuration.
/// </summary>
public static class PlatformDefaultsSeeder
{
    private const int MaxObjectiveCountLimit = 10;
    private const string SupportedWeights = "5,10,15,20,25,30,40,50";
    private const int StartingObjectiveCount = 5;
    private const string StartingWeights = "5,10,15,20,25,30,40,50";
    private const string StartingMeasurementTypes = "Quantitative,Qualitative";

    public static async Task SeedAsync(PerformanceDbContext db, CancellationToken cancellationToken = default)
    {
        if (!await db.PlatformPerformanceGuardrails.AnyAsync(cancellationToken))
        {
            var guardrails = PlatformPerformanceGuardrails.CreateApplied(
                MaxObjectiveCountLimit,
                SupportedWeights,
                quantitativeAvailable: true,
                qualitativeAvailable: true);
            db.PlatformPerformanceGuardrails.Add(guardrails);
            await db.SaveChangesAsync(cancellationToken);
        }

        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline is null)
        {
            baseline = PlatformObjectiveBaseline.Create();
            baseline.Apply(StartingObjectiveCount, StartingWeights, StartingMeasurementTypes);
            db.PlatformObjectiveBaselines.Add(baseline);
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (baseline.CurrentVersion is null)
        {
            baseline.Apply(StartingObjectiveCount, StartingWeights, StartingMeasurementTypes);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
