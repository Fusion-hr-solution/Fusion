using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Reaps attachments that remain pending (uncommitted) beyond the configured abandonment age,
/// removing both stored bytes and metadata. Committed attachments are never touched.
/// </summary>
public sealed class AttachmentCleanupJob(
    IServiceProvider services,
    IOptions<ScheduledJobsOptions> jobOptions,
    IOptions<AttachmentOptions> attachmentOptions,
    ILogger<AttachmentCleanupJob> logger) : IScheduledJob
{
    public string Name => "attachment-cleanup";

    public TimeSpan Interval => jobOptions.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, jobOptions.Value.AttachmentCleanupIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow.AddHours(-Math.Max(1, attachmentOptions.Value.AbandonmentAgeHours));

        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await db.Attachments
                .IgnoreQueryFilters()
                .Where(a => a.Status == AttachmentStatus.Pending && a.CreatedAt < cutoff)
                .Select(a => a.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
        {
            total += await ProcessTenantAsync(tenantId, cutoff, cancellationToken);
        }

        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, DateTime cutoff, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IAttachmentStorage>();

        var stale = await db.Attachments
            .Where(a => a.Status == AttachmentStatus.Pending && a.CreatedAt < cutoff)
            .ToListAsync(cancellationToken);
        if (stale.Count == 0)
        {
            return 0;
        }

        foreach (var attachment in stale)
        {
            await storage.DeleteAsync(attachment.StorageKey, cancellationToken);
            db.Attachments.Remove(attachment);
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Reaped {Count} abandoned attachment(s) for tenant {TenantId}.", stale.Count, tenantId);
        return stale.Count;
    }
}
