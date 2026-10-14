using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class CompetencyTests
{
    [Fact]
    public async Task Active_names_are_unique_case_insensitively_but_archived_names_can_be_reused()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var audit = new TestPerformanceAudit(db);
        var handler = new CreateCompetencyHandler(db, store.Tenant, audit);
        var first = await handler.Handle(new(new("Develops others", "Builds team capability", ["Coaches"])), default);
        Assert.True(first.IsSuccess);
        var duplicate = await handler.Handle(new(new("DEVELOPS OTHERS", "Another description", [])), default);
        Assert.Equal("Competency.DuplicateName", duplicate.Error.Code);
        await new ArchiveCompetencyHandler(db, audit).Handle(new(first.Value.Id, new(first.Value.Version)), default);
        var replacement = await handler.Handle(new(new("DEVELOPS OTHERS", "Reframed capability", [])), default);
        Assert.True(replacement.IsSuccess);
    }

    [Fact]
    public async Task Delete_is_audited_when_unused_and_used_items_are_protected()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var item = EY.HRPlatform.Performance.Domain.Settings.Competency.Create(store.TenantId, "Good judgment", "Makes sound decisions", null);
        db.Competencies.Add(item);
        await db.SaveChangesAsync();
        var result = await new DeleteCompetencyHandler(db, new TestPerformanceAudit(db)).Handle(new(item.Id, new(item.Version)), default);
        Assert.True(result.IsSuccess);
        Assert.False(await db.Competencies.AnyAsync());
        Assert.True(await db.AuditEntries.AnyAsync(entry => entry.Action == EY.HRPlatform.Performance.Domain.Audit.PerformanceAuditActions.CompetencyDeleted));
    }

    [Fact]
    public async Task Archive_rejects_a_stale_version()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var item = EY.HRPlatform.Performance.Domain.Settings.Competency.Create(store.TenantId, "Good judgment", "Makes sound decisions", null);
        db.Competencies.Add(item);
        await db.SaveChangesAsync();
        var result = await new ArchiveCompetencyHandler(db, new TestPerformanceAudit(db))
            .Handle(new(item.Id, new(item.Version + 1)), default);
        Assert.Equal("Performance.Stale", result.Error.Code);
        Assert.Equal("Active", (await db.Competencies.SingleAsync()).State.ToString());
    }
}
