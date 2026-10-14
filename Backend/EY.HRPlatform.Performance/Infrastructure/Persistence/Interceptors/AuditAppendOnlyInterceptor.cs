using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;

public sealed class AuditAppendOnlyInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Validate(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
        InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Validate(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private static void Validate(DbContext? context)
    {
        if (context is null) return;
        if (context.ChangeTracker.Entries<PerformanceAuditEntry>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Performance audit entries cannot be modified or deleted.");
        if (context.ChangeTracker.Entries<RatingScaleVersion>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Rating scale versions cannot be modified or deleted.");
        if (context.ChangeTracker.Entries<CalibrationAdjustment>()
            .Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Calibration history cannot be modified or deleted.");
    }
}
