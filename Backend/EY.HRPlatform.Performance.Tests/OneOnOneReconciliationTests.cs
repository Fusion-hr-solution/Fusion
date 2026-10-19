using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Features.OneOnOnes;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>D-12: a series ends with its reporting line even when nobody touches it.</summary>
public sealed class OneOnOneReconciliationTests
{
    [Fact]
    public async Task A_series_whose_report_moved_ends_and_an_intact_one_is_untouched()
    {
        var store = TestStore.ForNewTenant();
        var workforce = new FakeCoreWorkforceClient();
        var karim = workforce.Add("Karim Haddad").EmployeeId;
        var leila = workforce.Add("Leila Baccouche").EmployeeId;
        var nour = workforce.Add("Nour Trabelsi", managerId: karim).EmployeeId;
        var sami = workforce.Add("Sami Kefi", managerId: karim).EmployeeId;
        var now = DateTime.UtcNow;
        Guid moved, intact;
        await using (var db = store.NewContext())
        {
            var (a, aMeeting) = OneOnOneSeries.Start(store.TenantId, karim, nour, OneOnOneCadence.Weekly, karim, now.AddHours(2), now);
            var (b, bMeeting) = OneOnOneSeries.Start(store.TenantId, karim, sami, OneOnOneCadence.Weekly, karim, now.AddHours(2), now);
            db.AddRange(a, aMeeting, b, bMeeting);
            await db.SaveChangesAsync();
            (moved, intact) = (a.Id, b.Id);
        }
        var nourNow = workforce.ById[nour];
        workforce.ById[nour] = nourNow with { Manager = new WorkforceManagerSnapshot(leila, "Leila Baccouche", true) };

        await using (var db = store.NewContext())
            Assert.Equal(1, await OneOnOneReconciler.ReconcileTenantAsync(db, workforce, now, CancellationToken.None));

        await using var check = store.NewContext();
        var ended = await check.OneOnOneSeries.SingleAsync(s => s.Id == moved);
        Assert.Equal(OneOnOneEndReason.ReportingLineEnded, ended.EndReason);
        Assert.Equal(OneOnOneMeetingState.NotHeld, (await check.OneOnOneMeetings.SingleAsync(m => m.SeriesId == moved)).State);
        Assert.Null((await check.OneOnOneSeries.SingleAsync(s => s.Id == intact)).EndedAt);
        Assert.Equal(OneOnOneMeetingState.Upcoming, (await check.OneOnOneMeetings.SingleAsync(m => m.SeriesId == intact)).State);
        Assert.Single(await check.AuditEntries.Where(e => e.Action == PerformanceAuditActions.OneOnOneEnded).ToListAsync());

        // A second pass finds nothing more to end.
        await using var again = store.NewContext();
        Assert.Equal(0, await OneOnOneReconciler.ReconcileTenantAsync(again, workforce, now, CancellationToken.None));
    }
}
