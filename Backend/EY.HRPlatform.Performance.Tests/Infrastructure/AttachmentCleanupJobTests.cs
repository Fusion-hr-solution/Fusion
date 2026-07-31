using System.Reflection;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Infrastructure.Jobs;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public sealed class AttachmentCleanupJobTests : IDisposable
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"attach-cleanup-{Guid.NewGuid():N}");

    private ServiceProvider BuildProvider(string dbName)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<ICurrentUserContext>(_ => new StubCurrentUserContext());
        services.AddDbContext<PerformanceDbContext>(o => o.UseInMemoryDatabase(dbName), ServiceLifetime.Scoped);
        services.Configure<ScheduledJobsOptions>(o => o.Enabled = true);
        services.Configure<AttachmentOptions>(o => { o.StorageRoot = _root; o.AbandonmentAgeHours = 24; });
        services.AddSingleton<IAttachmentStorage, FileSystemAttachmentStorage>();
        services.AddSingleton<IScheduledJob, AttachmentCleanupJob>();
        return services.BuildServiceProvider();
    }

    private static void Backdate(BaseEntity entity, DateTime createdAt)
        => typeof(BaseEntity).GetProperty(nameof(BaseEntity.CreatedAt))!
            .SetValue(entity, createdAt);

    [Fact]
    public async Task Cleanup_ReapsStalePending_LeavesCommitted()
    {
        var dbName = $"cleanup-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);

        Guid stalePendingId;
        Guid committedId;
        using (var scope = provider.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(TenantId);
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var storage = scope.ServiceProvider.GetRequiredService<IAttachmentStorage>();

            var stale = Attachment.CreatePending(TenantId, "FeedbackResponse", null, Guid.NewGuid(), "s.txt", "text/plain", 3);
            Backdate(stale, DateTime.UtcNow.AddDays(-2));
            await storage.PutAsync(stale.StorageKey, new MemoryStream([1, 2, 3]), CancellationToken.None);

            var committed = Attachment.CreatePending(TenantId, "FeedbackResponse", null, Guid.NewGuid(), "c.txt", "text/plain", 3);
            Backdate(committed, DateTime.UtcNow.AddDays(-2));
            committed.Commit(DateTime.UtcNow.AddDays(-2));
            await storage.PutAsync(committed.StorageKey, new MemoryStream([4, 5, 6]), CancellationToken.None);

            db.Attachments.AddRange(stale, committed);
            await db.SaveChangesAsync();
            stalePendingId = stale.Id;
            committedId = committed.Id;
        }

        var job = provider.GetServices<IScheduledJob>().OfType<AttachmentCleanupJob>().Single();
        var reaped = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(1, reaped);
        using var verify = provider.CreateScope();
        verify.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(TenantId);
        var vdb = verify.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        Assert.False(await vdb.Attachments.AnyAsync(a => a.Id == stalePendingId));
        Assert.True(await vdb.Attachments.AnyAsync(a => a.Id == committedId));
    }

    [Fact]
    public async Task Cleanup_LeavesFreshPending()
    {
        var dbName = $"cleanup-fresh-{Guid.NewGuid()}";
        await using var provider = BuildProvider(dbName);

        using (var scope = provider.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(TenantId);
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var fresh = Attachment.CreatePending(TenantId, "FeedbackResponse", null, Guid.NewGuid(), "f.txt", "text/plain", 3);
            db.Attachments.Add(fresh); // CreatedAt = now, within the abandonment window
            await db.SaveChangesAsync();
        }

        var job = provider.GetServices<IScheduledJob>().OfType<AttachmentCleanupJob>().Single();
        var reaped = await job.ExecuteAsync(CancellationToken.None);

        Assert.Equal(0, reaped);
    }

    public void Dispose()
    {
        try { if (Directory.Exists(_root)) Directory.Delete(_root, true); } catch { /* best-effort */ }
    }
}
