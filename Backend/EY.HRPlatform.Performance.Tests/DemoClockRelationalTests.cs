using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Cycles;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Under the demo clock, new rows are created at the simulated instant (performance-demo-clock).</summary>
public sealed class DemoClockRelationalTests
{
    private static readonly DateTime Past = new(2025, 6, 2, 8, 0, 0, DateTimeKind.Utc);

    [RelationalDatabaseFact]
    public async Task Rows_added_under_the_clock_carry_the_simulated_created_time_and_others_the_real_one()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new Npgsql.NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenant = Guid.NewGuid();
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            await using (var db = RelationalTests.CreateDb(connection, tenant)) await db.Database.MigrateAsync();

            Guid pastId, presentId;
            using (PerformanceClock.Travel(Past))
            {
                await using var db = RelationalTests.CreateDb(connection, tenant);
                var cycle = PerformanceCycle.CreateDraft(tenant, "FY2025", new DateOnly(2025, 6, 1), new DateOnly(2026, 5, 31), new DateOnly(2025, 7, 1));
                db.Cycles.Add(cycle);
                await db.SaveChangesAsync();
                pastId = cycle.Id;
            }

            var before = DateTime.UtcNow.AddSeconds(-5);
            await using (var db = RelationalTests.CreateDb(connection, tenant))
            {
                var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", new DateOnly(2026, 6, 1), new DateOnly(2027, 5, 31), new DateOnly(2026, 7, 1));
                db.Cycles.Add(cycle);
                await db.SaveChangesAsync();
                presentId = cycle.Id;
            }

            await using var read = RelationalTests.CreateDb(connection, tenant);
            var past = await read.Cycles.SingleAsync(c => c.Id == pastId);
            var present = await read.Cycles.SingleAsync(c => c.Id == presentId);
            Assert.Equal(Past, past.CreatedAt);
            Assert.True(present.CreatedAt >= before, $"Expected real time, got {present.CreatedAt:O}.");
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
}
