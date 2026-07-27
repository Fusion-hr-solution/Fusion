using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ActivityLog;

/// <summary>
/// The append-only histories only grow, so their reads are bounded by the server rather than by the
/// caller's request. An oversized page is clamped, not rejected; a page past the end is empty rather
/// than an error; and paging is stable when entries share a timestamp.
/// </summary>
public sealed class HistoryPaginationTests
{
    [Theory]
    [InlineData(null, null, 1, HistoryPage.DefaultPageSize)]
    [InlineData(0, 0, 1, HistoryPage.DefaultPageSize)]
    [InlineData(-5, -5, 1, HistoryPage.DefaultPageSize)]
    [InlineData(3, 10, 3, 10)]
    [InlineData(1, 10_000, 1, HistoryPage.MaxPageSize)]
    public void An_oversized_or_nonsensical_request_is_clamped_rather_than_rejected(
        int? page, int? pageSize, int expectedPage, int expectedPageSize)
    {
        var clamped = HistoryPage.From(page, pageSize);

        Assert.Equal(expectedPage, clamped.Page);
        Assert.Equal(expectedPageSize, clamped.PageSize);
    }

    [Fact]
    public void Skip_follows_from_the_clamped_page()
    {
        Assert.Equal(0, HistoryPage.From(1, 20).Skip);
        Assert.Equal(40, HistoryPage.From(3, 20).Skip);
        // Clamped size drives skip, so an oversized request cannot skip past its own served window.
        Assert.Equal(HistoryPage.MaxPageSize, HistoryPage.From(2, 10_000).Skip);
    }

    private static async Task<(Guid TenantId, string DbName, Guid SubjectId)> SeedActivityAsync(int count)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"activity-paging-{Guid.NewGuid()}";
        var subjectId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var writer = new ActivityLogWriter(db, tenant, new StubCurrentUserContext());
        for (var i = 0; i < count; i++)
        {
            writer.Record($"Action{i:D3}", "EmployeeObjectivePlan", subjectId);
        }

        await db.SaveChangesAsync();
        return (tenantId, dbName, subjectId);
    }

    [Fact]
    public async Task A_page_carries_its_items_and_the_true_total()
    {
        var seeded = await SeedActivityAsync(30);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var result = await new ActivityLogReader(db).GetSubjectHistoryAsync(
            "EmployeeObjectivePlan", seeded.SubjectId, authorized: true, CancellationToken.None,
            page: 1, pageSize: 10);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Value.Items.Count);
        Assert.Equal(30, result.Value.TotalCount);
        Assert.Equal(3, result.Value.TotalPages);
        Assert.True(result.Value.HasNextPage);
        Assert.False(result.Value.HasPreviousPage);
    }

    [Fact]
    public async Task A_page_past_the_end_is_empty_but_still_reports_the_total()
    {
        var seeded = await SeedActivityAsync(12);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var result = await new ActivityLogReader(db).GetSubjectHistoryAsync(
            "EmployeeObjectivePlan", seeded.SubjectId, authorized: true, CancellationToken.None,
            page: 99, pageSize: 10);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Items);

        // "No more" is distinguishable from "nothing here".
        Assert.Equal(12, result.Value.TotalCount);
    }

    [Fact]
    public async Task Paging_is_stable_and_never_repeats_or_drops_an_entry()
    {
        var seeded = await SeedActivityAsync(25);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var reader = new ActivityLogReader(db);

        var collected = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            var result = await reader.GetSubjectHistoryAsync(
                "EmployeeObjectivePlan", seeded.SubjectId, authorized: true, CancellationToken.None,
                page: page, pageSize: 10);

            collected.AddRange(result.Value.Items.Select(entry => entry.Id));
        }

        // The entries are written in one batch and share a timestamp, so only the Id tiebreak
        // keeps the window from shifting between pages.
        Assert.Equal(25, collected.Count);
        Assert.Equal(25, collected.Distinct().Count());
    }

    [Fact]
    public async Task An_unauthorized_read_is_denied_before_any_paging_happens()
    {
        var seeded = await SeedActivityAsync(5);

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var result = await new ActivityLogReader(db).GetSubjectHistoryAsync(
            "EmployeeObjectivePlan", seeded.SubjectId, authorized: false, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ActivityLog.Forbidden", result.Error.Code);
    }
}
