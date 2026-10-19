using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.OneOnOnes;

/// <summary>
/// Ends 1:1 series whose reporting line Core HR no longer reports (D-12), so a series nobody touches still ends.
/// Writes already end a broken series on the spot; this catches the rest. Runs per tenant, in batches.
/// </summary>
public sealed class OneOnOneReconciler(IServiceScopeFactory scopes)
{
    public const int BatchSize = 200;
    private const string Actor = "system:one-on-one-reconciliation";

    public async Task<int> ReconcileAsync(DateTime now, CancellationToken cancellationToken)
    {
        List<Guid> tenants;
        await using (var discovery = scopes.CreateAsyncScope())
        {
            var db = discovery.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            // Discovery reads tenant identifiers only; every read and write after it is tenant-filtered.
            tenants = await db.Database.SqlQuery<Guid>($"""
                SELECT DISTINCT s."TenantId" AS "Value" FROM performance."OneOnOneSeries" s WHERE s."EndedAt" IS NULL
                """).ToListAsync(cancellationToken);
        }
        var ended = 0;
        foreach (var tenantId in tenants)
        {
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
            ended += await ReconcileTenantAsync(scope.ServiceProvider.GetRequiredService<PerformanceDbContext>(),
                scope.ServiceProvider.GetRequiredService<ICoreWorkforceClient>(), now, cancellationToken);
        }
        return ended;
    }

    /// <summary>One tenant's active series, checked against Core in batches; returns how many ended.</summary>
    public static async Task<int> ReconcileTenantAsync(PerformanceDbContext db, ICoreWorkforceClient workforce, DateTime now,
        CancellationToken cancellationToken)
    {
        var ended = 0;
        var activeIds = await db.OneOnOneSeries.Where(s => s.EndedAt == null).Select(s => s.Id).ToListAsync(cancellationToken);
        foreach (var chunk in activeIds.Chunk(BatchSize))
        {
            var ids = chunk.ToList();
            var batch = await db.OneOnOneSeries.Where(s => ids.Contains(s.Id) && s.EndedAt == null).ToListAsync(cancellationToken);
            if (batch.Count == 0) continue;
            var people = await workforce.ResolveAsync(now,
                batch.SelectMany(s => new[] { s.ManagerEmployeeId, s.ReportEmployeeId }).Distinct().ToList(), cancellationToken);
            var endedIds = new List<Guid>();
            foreach (var series in batch)
            {
                if (OneOnOneHandlerBase.EndReasonFor(series, people) is not OneOnOneEndReason reason || !series.End(reason, now)) continue;
                endedIds.Add(series.Id);
                db.AuditEntries.Add(PerformanceAuditEntry.Record(series.TenantId, "OneOnOneSeries", series.Id, null,
                    PerformanceAuditActions.OneOnOneEnded,
                    new { reason = reason.ToString(), managerEmployeeId = series.ManagerEmployeeId, reportEmployeeId = series.ReportEmployeeId },
                    Actor, null, $"one-on-one-reconciliation:{now:O}"));
            }
            if (endedIds.Count > 0)
            {
                foreach (var meeting in await db.OneOnOneMeetings
                    .Where(m => endedIds.Contains(m.SeriesId) && m.State == OneOnOneMeetingState.Upcoming).ToListAsync(cancellationToken))
                    meeting.MarkNotHeld();
                await db.SaveChangesAsync(cancellationToken);
                ended += endedIds.Count;
            }
        }
        return ended;
    }
}
