using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

public sealed class TestPerformanceAudit(PerformanceDbContext db) : IPerformanceAudit
{
    public void Record(Guid tenantId, string resourceType, Guid resourceId, Guid? cycleId, string action, object summary)
        => db.AuditEntries.Add(PerformanceAuditEntry.Record(tenantId, resourceType, resourceId, cycleId,
            action, summary, "test-user", null, "test-request"));
}

public static class AuditAssertions
{
    public static async Task RecordedAsync(PerformanceDbContext db, string action, Guid resourceId, Guid? cycleId)
    {
        var entries = await db.AuditEntries.AsNoTracking()
            .Where(e => e.Action == action && e.ResourceId == resourceId).ToListAsync();
        Assert.NotEmpty(entries);
        foreach (var entry in entries)
        {
            Assert.Equal(cycleId, entry.CycleId);
            Assert.NotEqual(Guid.Empty, entry.TenantId);
            Assert.Equal("test-user", entry.ActorSubject);
            Assert.Equal("test-request", entry.CorrelationId);
            Assert.False(string.IsNullOrWhiteSpace(entry.ResourceType));
            Assert.True(entry.OccurredAt <= DateTime.UtcNow);
            using var summary = JsonDocument.Parse(entry.Summary);
            Assert.True(summary.RootElement.TryGetProperty("before", out _));
            Assert.True(summary.RootElement.TryGetProperty("after", out _));
        }
    }
}
