using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

public sealed class ConversationsRelationalTests
{
    [RelationalDatabaseFact]
    public async Task One_active_series_per_pair_one_reaction_per_kind_and_the_migration_rolls_back()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenant = Guid.NewGuid();
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            await using var db = RelationalTests.CreateDb(connection, tenant);
            await db.Database.MigrateAsync();
            var now = DateTime.UtcNow;
            var manager = Guid.NewGuid();
            var report = Guid.NewGuid();

            var (first, firstMeeting) = OneOnOneSeries.Start(tenant, manager, report, OneOnOneCadence.Weekly, report, now.AddHours(2), now);
            db.OneOnOneSeries.Add(first);
            db.OneOnOneMeetings.Add(firstMeeting);
            await db.SaveChangesAsync();

            var (second, secondMeeting) = OneOnOneSeries.Start(tenant, manager, report, OneOnOneCadence.Weekly, manager, now.AddHours(3), now);
            db.OneOnOneSeries.Add(second);
            db.OneOnOneMeetings.Add(secondMeeting);
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();

            // Once the first series ends, the pair can start again.
            var tracked = await db.OneOnOneSeries.SingleAsync();
            tracked.End(OneOnOneEndReason.ReportingLineEnded, now);
            var (again, againMeeting) = OneOnOneSeries.Start(tenant, manager, report, OneOnOneCadence.Monthly, manager, now.AddHours(3), now);
            db.OneOnOneSeries.Add(again);
            db.OneOnOneMeetings.Add(againMeeting);
            await db.SaveChangesAsync();
            Assert.Equal(2, await db.OneOnOneSeries.CountAsync());

            // Agenda and action items with client ids save as new rows on a tracked meeting and series.
            againMeeting.AddAgendaItem(Guid.NewGuid(), "Vendor API timeline", manager, null, out _);
            again.AddAction(Guid.NewGuid(), "Send the draft", report, null, againMeeting.Id, manager, out _);
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            Assert.Single((await db.OneOnOneMeetings.SingleAsync(m => m.Id == againMeeting.Id)).Agenda);
            Assert.Single((await db.OneOnOneSeries.SingleAsync(s => s.Id == again.Id)).Actions);

            var praise = Praise.Give(Guid.NewGuid(), tenant, manager, "Karim", Guid.NewGuid(), "Great cut-over", [(report, "Nour")], now);
            db.Praise.Add(praise);
            db.PraiseReactions.Add(PraiseReaction.Create(tenant, praise.Id, report, PraiseReactionKind.Celebrate));
            await db.SaveChangesAsync();
            db.PraiseReactions.Add(PraiseReaction.Create(tenant, praise.Id, report, PraiseReactionKind.Celebrate));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();

            var migrations = db.Database.GetMigrations().ToArray();
            var index = Array.FindIndex(migrations, m => m.EndsWith("_AddOneOnOnesFeedbackAndPraise"));
            Assert.True(index > 0);
            await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync(migrations[index - 1]);
            Assert.Equal(0, await db.Database.SqlQueryRaw<int>("""
                SELECT count(*)::int AS "Value" FROM information_schema.tables
                WHERE table_schema='performance' AND table_name IN ('OneOnOneSeries','OneOnOneMeetings','Feedback','FeedbackRequests','Praise','PraiseReactions')
                """).SingleAsync());
            Assert.Equal(0, await db.Database.SqlQueryRaw<int>("""
                SELECT count(*)::int AS "Value" FROM information_schema.columns
                WHERE table_schema='performance' AND table_name='CycleSettings' AND column_name='DefaultOneOnOneCadence'
                """).SingleAsync());
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
}
