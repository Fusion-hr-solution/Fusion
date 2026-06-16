using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Budget;

/// <summary>
/// Single source of truth for "Spend": committed external-trainer session costs charged to a service
/// line within a half-open period [periodStart, periodEnd). Non-cancelled sessions only, filed by
/// session StartUtc. IgnoreQueryFilters so committed spend still counts after a course is soft-deleted.
/// </summary>
public static class BudgetSpendCalculator
{
    public static Task<decimal> ComputeSpendAsync(
        TrainingDbContext db, Guid serviceLineId, DateTime periodStart, DateTime periodEnd,
        CancellationToken cancellationToken) =>
        db.TrainingSessions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(s => s.Status != SessionStatus.Cancelled
                && s.StartUtc >= periodStart && s.StartUtc < periodEnd
                && s.Part.Training.CostType == CostType.External
                && s.Part.Training.SponsoringServiceLineId == serviceLineId)
            .Select(s => (s.ExternalTrainerCost ?? 0m) + (s.VenueCost ?? 0m)
                       + (s.MaterialsCost ?? 0m) + (s.OtherCost ?? 0m))
            .SumAsync(cancellationToken);
}
