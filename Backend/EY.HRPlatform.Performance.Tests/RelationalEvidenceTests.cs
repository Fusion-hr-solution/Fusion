using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

public sealed class RelationalEvidenceTests
{
    private sealed class FailOnceEvidenceStore(IPerformanceEvidenceStore inner) : IPerformanceEvidenceStore
    {
        public bool FailNextDelete { get; set; } = true;
        public Task<string> SaveAsync(Stream content, string fileName, CancellationToken cancellationToken)
            => inner.SaveAsync(content, fileName, cancellationToken);
        public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken)
            => inner.OpenAsync(storageKey, cancellationToken);
        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
        {
            if (FailNextDelete)
            {
                FailNextDelete = false;
                throw new IOException("Simulated storage outage.");
            }
            return inner.DeleteAsync(storageKey, cancellationToken);
        }
    }

    [RelationalDatabaseFact]
    public async Task Retention_removes_expired_closed_cycle_files_retries_failures_and_keeps_active_cycle_files()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var database = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = database, Pooling = false }.ConnectionString;
        var root = Path.Combine(Path.GetTempPath(), $"fusion-evidence-retention-{Guid.NewGuid():N}");
        var now = DateTime.UtcNow;
        var tenant = Guid.NewGuid();
        var expiredKey = string.Empty;
        var activeKey = string.Empty;
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, database);
            await using (var db = RelationalTests.CreateDb(connection, tenant))
            {
                await db.Database.MigrateAsync();
                var local = new LocalPerformanceEvidenceStore(TestTenantContext.WithTenant(tenant), root);
                expiredKey = await local.SaveAsync(new MemoryStream("expired"u8.ToArray()), "expired.pdf", default);
                activeKey = await local.SaveAsync(new MemoryStream("active"u8.ToArray()), "active.pdf", default);

                var closed = PerformanceCycle.CreateDraft(tenant, "Closed", new(2024, 1, 1), new(2024, 12, 31), new(2024, 2, 1)).Activated();
                closed.Close();
                db.Entry(closed).Property(cycle => cycle.ClosedAt).CurrentValue = now.AddMonths(-2);
                var active = PerformanceCycle.CreateDraft(tenant, "Active", new(2025, 1, 1), new(2026, 12, 31), new(2025, 2, 1)).Activated();
                db.Cycles.AddRange(closed, active);

                var settings = CycleSettings.CreateDefault(tenant);
                db.CycleSettings.Add(settings);
                var expiredUpdate = ProgressUpdate.RecordPercentage(tenant, closed.Id, Guid.NewGuid(), Guid.NewGuid(), 10, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, false);
                var expiredItem = EvidenceItem.File(tenant, "expired.pdf", "application/pdf", 7, expiredKey);
                expiredUpdate.AttachEvidence(expiredItem);
                var staged = EvidenceUpload.Stage(tenant, closed.Id, expiredUpdate.ObjectiveId, expiredUpdate.AuthorEmployeeId,
                    expiredKey, "expired.pdf", "application/pdf", 7);
                staged.Claim(staged.ObjectiveId, staged.UploaderEmployeeId);
                db.ProgressUpdates.Add(expiredUpdate);
                db.EvidenceUploads.Add(staged);

                var activeUpdate = ProgressUpdate.RecordPercentage(tenant, active.Id, Guid.NewGuid(), Guid.NewGuid(), 20, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, false);
                var activeItem = EvidenceItem.File(tenant, "active.pdf", "application/pdf", 6, activeKey);
                activeUpdate.AttachEvidence(activeItem);
                db.ProgressUpdates.Add(activeUpdate);
                await db.SaveChangesAsync();
            }

            var tenantContext = TestTenantContext.WithTenant(tenant);
            var retryStore = new FailOnceEvidenceStore(new LocalPerformanceEvidenceStore(tenantContext, root));
            var services = new ServiceCollection();
            services.AddScoped<TenantContext>();
            services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
            services.AddDbContext<PerformanceDbContext>((sp, options) => options.UseNpgsql(connection)
                .AddInterceptors(new TenantSaveChangesInterceptor(sp.GetRequiredService<ITenantContext>())));
            services.AddSingleton<IPerformanceEvidenceStore>(retryStore);
            await using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
            var sweeper = new EvidenceUploadSweeper(provider.GetRequiredService<IServiceScopeFactory>());

            // A 36-month policy keeps this file. Shortening it applies to the already-closed Cycle.
            Assert.Equal(0, await sweeper.SweepAsync(now, default));
            await using (var shorten = RelationalTests.CreateDb(connection, tenant))
            {
                var settings = await shorten.CycleSettings.SingleAsync();
                settings.Update(settings.DefaultMeasurementMethod, settings.SuggestedObjectiveCountMin,
                    settings.SuggestedObjectiveCountMax, settings.PlanningDeadlineOffsetDays,
                    settings.PlanAlignmentPolicy, evidenceRetentionMonths: 1);
                await shorten.SaveChangesAsync();
            }

            await Assert.ThrowsAsync<IOException>(() => sweeper.SweepAsync(now, default));
            await using (var afterFailure = RelationalTests.CreateDb(connection, tenant))
            {
                var pending = await afterFailure.EvidenceItems.SingleAsync(item => item.StorageKey == expiredKey);
                Assert.False(pending.IsRemovedUnderRetention);
                Assert.True(File.Exists(Path.Combine(root, expiredKey.Replace('/', Path.DirectorySeparatorChar))));
            }

            await sweeper.SweepAsync(now, default);
            await using (var verify = RelationalTests.CreateDb(connection, tenant))
            {
                var removed = await verify.EvidenceItems.SingleAsync(item => item.IsRemovedUnderRetention);
                Assert.Null(removed.FileName);
                Assert.Null(removed.StorageKey);
                Assert.Empty(await verify.EvidenceUploads.ToListAsync());
                var stillActive = await verify.EvidenceItems.SingleAsync(item => item.StorageKey == activeKey);
                Assert.False(stillActive.IsRemovedUnderRetention);
                Assert.True(File.Exists(Path.Combine(root, activeKey.Replace('/', Path.DirectorySeparatorChar))));
            }
            Assert.False(File.Exists(Path.Combine(root, expiredKey.Replace('/', Path.DirectorySeparatorChar))));
        }
        finally
        {
            await RelationalTests.DropDatabaseAsync(baseConnection, database);
            var local = new LocalPerformanceEvidenceStore(TestTenantContext.WithTenant(tenant), root);
            if (!string.IsNullOrEmpty(expiredKey)) await local.DeleteAsync(expiredKey, default);
            if (!string.IsNullOrEmpty(activeKey)) await local.DeleteAsync(activeKey, default);
            var partition = Path.Combine(root, tenant.ToString("N"));
            if (Directory.Exists(partition)) Directory.Delete(partition);
            if (Directory.Exists(root)) Directory.Delete(root);
        }
    }

    [RelationalDatabaseFact]
    public async Task Sweep_removes_only_stale_unclaimed_rows_and_files_and_claims_are_concurrency_protected()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var database = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = database, Pooling = false }.ConnectionString;
        var root = Path.Combine(Path.GetTempPath(), $"fusion-evidence-{Guid.NewGuid():N}");
        var now = DateTime.UtcNow; var tenantA = Guid.NewGuid(); var tenantB = Guid.NewGuid();
        List<(Guid Tenant, string Key)> files = [];
        Guid freshId = Guid.Empty;
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, database);
            foreach (var tenant in new[] { tenantA, tenantB })
            {
                await using var db = RelationalTests.CreateDb(connection, tenant);
                await db.Database.MigrateAsync();
                var store = new LocalPerformanceEvidenceStore(TestTenantContext.WithTenant(tenant), root);
                foreach (var state in new[] { "stale", "fresh", "boundary", "claimed" })
                {
                    var key = await store.SaveAsync(new MemoryStream("proof"u8.ToArray()), "proof.txt", default);
                    files.Add((tenant, key));
                    var upload = EvidenceUpload.Stage(tenant, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), key, "proof.txt", "text/plain", 5);
                    if (state == "claimed") upload.Claim(upload.ObjectiveId, upload.UploaderEmployeeId);
                    db.EvidenceUploads.Add(upload);
                    db.Entry(upload).Property(e => e.CreatedAt).CurrentValue = state switch
                    {
                        "fresh" => now.AddHours(-1), "boundary" => now.AddHours(-24), _ => now.AddHours(-25),
                    };
                    if (tenant == tenantA && state == "fresh") freshId = upload.Id;
                }
                await db.SaveChangesAsync();
            }
            var services = new ServiceCollection();
            services.AddScoped<TenantContext>();
            services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
            services.AddDbContext<PerformanceDbContext>((sp, options) => options.UseNpgsql(connection)
                .AddInterceptors(new TenantSaveChangesInterceptor(sp.GetRequiredService<ITenantContext>())));
            services.AddScoped<IPerformanceEvidenceStore>(sp => new LocalPerformanceEvidenceStore(sp.GetRequiredService<ITenantContext>(), root));
            await using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
            var sweeper = new EvidenceUploadSweeper(provider.GetRequiredService<IServiceScopeFactory>());
            Assert.Equal(2, await sweeper.SweepAsync(now, default));
            Assert.Equal(0, await sweeper.SweepAsync(now, default));
            foreach (var tenant in new[] { tenantA, tenantB })
            {
                await using var db = RelationalTests.CreateDb(connection, tenant);
                Assert.Equal(3, await db.EvidenceUploads.CountAsync());
                Assert.Single(await db.EvidenceUploads.Where(u => u.ClaimedAt != null).ToListAsync());
                var remaining = await db.EvidenceUploads.Select(u => u.StorageKey).ToListAsync();
                foreach (var file in files.Where(f => f.Tenant == tenant))
                    Assert.Equal(remaining.Contains(file.Key), File.Exists(Path.Combine(root, file.Key.Replace('/', Path.DirectorySeparatorChar))));
            }
            await using (var first = RelationalTests.CreateDb(connection, tenantA))
            await using (var second = RelationalTests.CreateDb(connection, tenantA))
            {
                var one = await first.EvidenceUploads.SingleAsync(u => u.Id == freshId);
                var two = await second.EvidenceUploads.SingleAsync(u => u.Id == freshId);
                one.Claim(one.ObjectiveId, one.UploaderEmployeeId);
                two.Claim(two.ObjectiveId, two.UploaderEmployeeId);
                await first.SaveChangesAsync();
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
            }
        }
        finally
        {
            await RelationalTests.DropDatabaseAsync(baseConnection, database);
            // Delete only the exact generated keys; directories are removed only when empty.
            foreach (var file in files)
                await new LocalPerformanceEvidenceStore(TestTenantContext.WithTenant(file.Tenant), root).DeleteAsync(file.Key, default);
            foreach (var tenant in files.Select(f => f.Tenant).Distinct())
            {
                var partition = Path.Combine(root, tenant.ToString("N"));
                if (Directory.Exists(partition)) Directory.Delete(partition);
            }
            if (Directory.Exists(root)) Directory.Delete(root);
        }
    }
}
