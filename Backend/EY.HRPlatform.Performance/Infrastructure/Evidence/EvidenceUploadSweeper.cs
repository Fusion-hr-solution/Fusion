using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Evidence;

public sealed class EvidenceUploadSweeper(IServiceScopeFactory scopes)
{
    public async Task<int> SweepAsync(DateTime now, CancellationToken cancellationToken)
    {
        var cutoff = now.AddHours(-24);
        List<Guid> tenants;
        await using (var discovery = scopes.CreateAsyncScope())
        {
            var db = discovery.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            // Background discovery reads tenant identifiers only; all resource work stays tenant-filtered.
            tenants = await db.Database.SqlQuery<Guid>($"""
                SELECT DISTINCT upload."TenantId" AS "Value"
                FROM performance."EvidenceUploads" upload
                WHERE upload."ClaimedAt" IS NULL AND upload."CreatedAt" < {cutoff}
                UNION
                SELECT DISTINCT evidence."TenantId" AS "Value"
                FROM performance."EvidenceItems" evidence
                JOIN performance."ProgressUpdates" update ON update."Id" = evidence."ProgressUpdateId"
                  AND update."TenantId" = evidence."TenantId"
                JOIN performance."PerformanceCycles" cycle ON cycle."Id" = update."CycleId"
                  AND cycle."TenantId" = evidence."TenantId"
                WHERE cycle."State" = 'Closed' AND cycle."ClosedAt" IS NOT NULL
                  AND evidence."StorageKey" IS NOT NULL AND evidence."IsRemovedUnderRetention" = FALSE
                """).ToListAsync(cancellationToken);
        }
        var removed = 0;
        foreach (var tenantId in tenants)
        {
            while (true)
            {
                await using var scope = scopes.CreateAsyncScope();
                scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
                var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
                var store = scope.ServiceProvider.GetRequiredService<IPerformanceEvidenceStore>();
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                var uploads = await db.EvidenceUploads.FromSqlInterpolated($"""
                    SELECT upload.*, upload.xmin FROM performance."EvidenceUploads" upload
                    WHERE upload."TenantId" = {tenantId} AND upload."ClaimedAt" IS NULL AND upload."CreatedAt" < {cutoff}
                    ORDER BY upload."CreatedAt", upload."Id" LIMIT 100 FOR UPDATE OF upload SKIP LOCKED
                    """).ToListAsync(cancellationToken);
                if (uploads.Count == 0) break;
                foreach (var upload in uploads)
                {
                    await store.DeleteAsync(upload.StorageKey, cancellationToken);
                    db.EvidenceUploads.Remove(upload);
                }
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                removed += uploads.Count;
            }

            removed += await SweepExpiredEvidenceAsync(tenantId, now, cancellationToken);
        }
        return removed;
    }

    private async Task<int> SweepExpiredEvidenceAsync(Guid tenantId, DateTime now, CancellationToken cancellationToken)
    {
        var removed = 0;
        while (true)
        {
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var store = scope.ServiceProvider.GetRequiredService<IPerformanceEvidenceStore>();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var items = await db.EvidenceItems.FromSqlInterpolated($"""
                SELECT evidence.* FROM performance."EvidenceItems" evidence
                JOIN performance."ProgressUpdates" update ON update."Id" = evidence."ProgressUpdateId"
                  AND update."TenantId" = evidence."TenantId"
                JOIN performance."PerformanceCycles" cycle ON cycle."Id" = update."CycleId"
                  AND cycle."TenantId" = evidence."TenantId"
                LEFT JOIN performance."CycleSettings" settings ON settings."TenantId" = evidence."TenantId"
                WHERE evidence."TenantId" = {tenantId}
                  AND evidence."Kind" = 'File' AND evidence."StorageKey" IS NOT NULL
                  AND evidence."IsRemovedUnderRetention" = FALSE
                  AND cycle."State" = 'Closed' AND cycle."ClosedAt" IS NOT NULL
                  AND CASE
                    WHEN COALESCE(settings."EvidenceRetentionMonths", 36) <= 120000
                    THEN cycle."ClosedAt" + make_interval(months => COALESCE(settings."EvidenceRetentionMonths", 36)) <= {now}
                    ELSE FALSE
                  END
                ORDER BY cycle."ClosedAt", evidence."Id"
                LIMIT 100 FOR UPDATE OF evidence SKIP LOCKED
                """).ToListAsync(cancellationToken);
            if (items.Count == 0) return removed;

            foreach (var item in items)
            {
                var key = item.StorageKey!;
                // Storage deletion is idempotent. If it fails, the transaction rolls back and
                // the row remains eligible for the next hourly run.
                await store.DeleteAsync(key, cancellationToken);
                var stagedUploads = await db.EvidenceUploads.Where(upload => upload.StorageKey == key).ToListAsync(cancellationToken);
                db.EvidenceUploads.RemoveRange(stagedUploads);
                item.RemoveUnderRetention();
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            removed += items.Count;
        }
    }
}
