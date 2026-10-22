using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.SharedKernel.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Under the demo clock, stamps <see cref="BaseEntity.CreatedAt"/> of new entities with the simulated
/// instant: SharedKernel sets it from the system time at construction. Does nothing otherwise.
/// </summary>
public sealed class DemoClockStampInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Stamp(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Stamp(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void Stamp(DbContext? context)
    {
        if (context is null || !PerformanceClock.IsSimulated) return;

        var now = PerformanceClock.UtcNow;
        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>())
            if (entry.State == EntityState.Added)
                entry.Property(nameof(BaseEntity.CreatedAt)).CurrentValue = now;
    }
}
