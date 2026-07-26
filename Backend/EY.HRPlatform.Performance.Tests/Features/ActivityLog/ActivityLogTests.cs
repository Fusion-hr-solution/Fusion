using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.ActivityLog;

public class ActivityLogTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    [Fact]
    public void Writer_Record_AddsTenantScopedEntry()
    {
        using var db = PerformanceTestContext.Create(TenantA, out var tenant);
        var writer = new ActivityLogWriter(db, tenant, new StubCurrentUserContext { UserId = Guid.NewGuid(), FullName = "Alice" });

        var subjectId = Guid.NewGuid();
        writer.Record("PlanApproved", "EmployeeObjectivePlan", subjectId, metadata: new { Foo = "bar" });
        db.SaveChanges();

        var stored = db.ActivityLogEntries.IgnoreQueryFilters().Single();
        Assert.Equal(TenantA, stored.TenantId);
        Assert.Equal("PlanApproved", stored.Action);
        Assert.Equal("EmployeeObjectivePlan", stored.SubjectType);
        Assert.Equal(subjectId, stored.SubjectId);
        Assert.Equal("Alice", stored.ActorName);
        Assert.Contains("bar", stored.Metadata);
    }

    [Fact]
    public void Writer_Record_WithoutMetadata_PersistsNullMetadata()
    {
        using var db = PerformanceTestContext.Create(TenantA, out var tenant);
        var writer = new ActivityLogWriter(db, tenant, new StubCurrentUserContext());

        writer.Record("CycleClosed", "PerformanceCycle", Guid.NewGuid());
        db.SaveChanges();

        Assert.Null(db.ActivityLogEntries.IgnoreQueryFilters().Single().Metadata);
    }

    [Fact]
    public async Task AppendOnly_DeleteIsRejected_SharedStore()
    {
        var dbName = $"activity-delete-{Guid.NewGuid()}";
        using (var seed = PerformanceTestContext.Create(TenantA, out var tenant, dbName))
        {
            new ActivityLogWriter(seed, tenant, new StubCurrentUserContext())
                .Record("CycleClosed", "PerformanceCycle", Guid.NewGuid());
            await seed.SaveChangesAsync();
        }

        using var db = PerformanceTestContext.Create(TenantA, out _, dbName);
        var entry = await db.ActivityLogEntries.SingleAsync();
        db.ActivityLogEntries.Remove(entry);
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Reader_CrossTenantRead_ReturnsNothing()
    {
        var dbName = $"activity-tenant-{Guid.NewGuid()}";
        var subjectId = Guid.NewGuid();
        using (var seed = PerformanceTestContext.Create(TenantA, out var tenant, dbName))
        {
            new ActivityLogWriter(seed, tenant, new StubCurrentUserContext())
                .Record("PlanApproved", "EmployeeObjectivePlan", subjectId);
            await seed.SaveChangesAsync();
        }

        using var db = PerformanceTestContext.Create(TenantB, out _, dbName);
        var reader = new ActivityLogReader(db);
        var result = await reader.GetSubjectHistoryAsync("EmployeeObjectivePlan", subjectId, authorized: true, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Reader_NoTenantContext_ReturnsNothing()
    {
        var dbName = $"activity-notenant-{Guid.NewGuid()}";
        var subjectId = Guid.NewGuid();
        using (var seed = PerformanceTestContext.Create(TenantA, out var tenant, dbName))
        {
            new ActivityLogWriter(seed, tenant, new StubCurrentUserContext())
                .Record("PlanApproved", "EmployeeObjectivePlan", subjectId);
            await seed.SaveChangesAsync();
        }

        // Design-time constructor => no tenant resolved => fail-closed query filter.
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        using var db = new PerformanceDbContext(options);
        var reader = new ActivityLogReader(db);
        var result = await reader.GetSubjectHistoryAsync("EmployeeObjectivePlan", subjectId, authorized: true, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Reader_OrdersMostRecentFirst()
    {
        var dbName = $"activity-order-{Guid.NewGuid()}";
        var subjectId = Guid.NewGuid();
        using (var seed = PerformanceTestContext.Create(TenantA, out var tenant, dbName))
        {
            var writer = new ActivityLogWriter(seed, tenant, new StubCurrentUserContext());
            writer.Record("First", "EmployeeObjectivePlan", subjectId);
            await seed.SaveChangesAsync();
            await Task.Delay(5);
            writer.Record("Second", "EmployeeObjectivePlan", subjectId);
            await seed.SaveChangesAsync();
        }

        using var db = PerformanceTestContext.Create(TenantA, out _, dbName);
        var reader = new ActivityLogReader(db);
        var result = await reader.GetSubjectHistoryAsync("EmployeeObjectivePlan", subjectId, authorized: true, CancellationToken.None);

        Assert.Equal(2, result.Value.Count);
        Assert.Equal("Second", result.Value[0].Action);
        Assert.Equal("First", result.Value[1].Action);
    }

    [Fact]
    public async Task Reader_Unauthorized_IsDenied()
    {
        using var db = PerformanceTestContext.Create(TenantA, out _);
        var reader = new ActivityLogReader(db);
        var result = await reader.GetSubjectHistoryAsync("EmployeeObjectivePlan", Guid.NewGuid(), authorized: false, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ActivityLog.Forbidden", result.Error.Code);
    }
}
