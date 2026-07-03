using EY.HRPlatform.Performance.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// Idempotently seeds the platform defaults (advanced limits + standard-setup baseline)
/// with the locked P1.1 values, so a fresh system exposes sensible published defaults and
/// tenant provisioning always has a Published baseline to copy. Uses the domain factories
/// (never raw inserts) so invariants and the xmin row-version are honoured. Safe to run on
/// every startup: it only creates what is missing and never overwrites admin-authored data.
/// </summary>
public static class PlatformDefaultsSeeder
{
    // Locked P1.1 supported limits (design D7).
    private const int MinObjectives = 1;
    private const int MaxObjectives = 10;
    private const int MinSlaDays = 1;
    private const int MaxSlaDays = 30;
    private const int WeightDecimalPlaces = 0;
    private const int MaxWeightChoices = 10;
    private const string SupportedMeasurementTypes = "Quantitative,Qualitative";
    private const int MaxTitleLength = 150;
    private const int MaxDescriptionLength = 500;
    private const int MaxTags = 10;

    // Locked P1.1 recommended standard-setup values (design D7).
    private const int BaselineObjectives = 7;
    private const string BaselineWeights = "5,10,15,20,25,30,40,50";
    private const int BaselineSlaDays = 10;
    private const string BaselineCascadeMode = "Optional";
    private const string BaselineMeasurementTypes = "Quantitative,Qualitative";
    private const bool BaselineAttachmentsEnabled = true;

    public static async Task SeedAsync(PerformanceDbContext db, CancellationToken cancellationToken = default)
    {
        var changed = false;

        // Advanced limits: seed one applied guardrails record only when none exists at all.
        if (!await db.PlatformPerformanceGuardrails.AnyAsync(cancellationToken))
        {
            var guardrails = PlatformPerformanceGuardrails.CreateApplied(
                MinObjectives, MaxObjectives, MinSlaDays, MaxSlaDays,
                WeightDecimalPlaces, MaxWeightChoices, SupportedMeasurementTypes,
                MaxTitleLength, MaxDescriptionLength, MaxTags);
            db.PlatformPerformanceGuardrails.Add(guardrails);
            changed = true;
        }

        // Standard setup: ensure a Published baseline version exists.
        var baseline = await db.PlatformObjectiveBaselines
            .Include(b => b.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (baseline is null)
        {
            baseline = PlatformObjectiveBaseline.Create();
            baseline.Apply(
                BaselineObjectives, BaselineWeights, BaselineSlaDays,
                BaselineCascadeMode, BaselineMeasurementTypes, BaselineAttachmentsEnabled);
            db.PlatformObjectiveBaselines.Add(baseline);
            changed = true;
        }
        else if (baseline.PublishedVersion is null)
        {
            // Baseline identity exists but has no live version (e.g. after data repair).
            baseline.Apply(
                BaselineObjectives, BaselineWeights, BaselineSlaDays,
                BaselineCascadeMode, BaselineMeasurementTypes, BaselineAttachmentsEnabled);
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync(cancellationToken);
    }
}
