using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Opt-in relational coverage. Set FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION to a
/// disposable PostgreSQL connection string to exercise the real EF migrations, the partial
/// unique single-Active index, the fail-closed tenant filter, and the frozen jsonb snapshot.
/// </summary>
public sealed class RelationalTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    [RelationalDatabaseFact]
    public async Task Single_active_index_and_tenant_isolation_hold_on_real_postgres()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection)
        {
            Database = databaseName,
            Pooling = false,
        }.ConnectionString;

        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantA = Guid.NewGuid();
            var tenantB = Guid.NewGuid();

            await using (var db = CreateDb(connectionString, tenantA))
            {
                await db.Database.MigrateAsync();

                var first = PerformanceCycle.CreateDraft(tenantA, "FY2026", Start, End, Start.AddDays(30));
                first.Activate(Snapshot(tenantA, first.Id));
                db.Cycles.Add(first);
                await db.SaveChangesAsync();

                // A second Active Cycle in the same tenant violates the partial unique index.
                var second = PerformanceCycle.CreateDraft(tenantA, "FY2027", Start.AddYears(1), End.AddYears(1), Start.AddYears(1).AddDays(30));
                second.Activate(Snapshot(tenantA, second.Id));
                db.Cycles.Add(second);
                await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            }

            // The frozen snapshot round-trips through jsonb and stays put.
            await using (var db = CreateDb(connectionString, tenantA))
            {
                var active = await db.Cycles.Include(c => c.ActivationSnapshot).SingleAsync(c => c.State == CycleLifecycleState.Active);
                Assert.NotNull(active.ActivationSnapshot);
                Assert.Contains("\"role\"", active.ActivationSnapshot!.StrategyJson);
                Assert.Contains("ceo", active.ActivationSnapshot.StrategyJson);
            }

            // Organizational goals (Chunk B): a calculated objective persists with a null direct
            // measurement (optional owned in the same table) and a contribution link, proving the
            // new columns and tables round-trip on real PostgreSQL.
            await using (var db = CreateDb(connectionString, tenantA))
            {
                var cycle = await db.Cycles.FirstAsync(c => c.State == CycleLifecycleState.Active);
                var strategic = Objective.CreateStrategic(tenantA, cycle.Id, "Grow", null, Guid.NewGuid(),
                    cycle.StartDate, cycle.EndDate, ObjectiveMeasurement.ManualPercentage(), cycle.StartDate, cycle.EndDate);
                strategic.Publish();
                db.Objectives.Add(strategic);
                await db.SaveChangesAsync();

                var org = Objective.CreateOrganizational(tenantA, cycle.Id, Guid.NewGuid(), "Operations", "Reliability", null,
                    Guid.NewGuid(), strategic.Id, cycle.StartDate, cycle.EndDate, ObjectiveProgressSource.Calculated, null,
                    cycle.StartDate, cycle.EndDate, cycle.StartDate, cycle.EndDate);
                org.ConfigureContribution([(Guid.NewGuid(), 100m)]);
                db.Objectives.Add(org);
                await db.SaveChangesAsync();
            }

            await using (var db = CreateDb(connectionString, tenantA))
            {
                var org = await db.Objectives.Include(o => o.ContributionLinks)
                    .SingleAsync(o => o.OwnershipScope == ObjectiveOwnershipScope.OrgUnit);
                Assert.Equal(ObjectiveProgressSource.Calculated, org.ProgressSource);
                Assert.Null(org.Measurement);
                Assert.Single(org.ContributionLinks);
            }

            // Another tenant sees no cycles at all.
            await using (var db = CreateDb(connectionString, tenantB))
            {
                Assert.Empty(await db.Cycles.ToListAsync());
            }
        }
        finally
        {
            await DropDatabaseAsync(baseConnection, databaseName);
        }
    }

    private static ActivationSnapshot Snapshot(Guid tenant, Guid cycleId)
        => ActivationSnapshot.Capture(tenant, cycleId, "FY", Start, End, Start.AddDays(30), Start, 1, "{}", "{}", "[]", "[{\"role\":\"ceo\"}]");

    private static PerformanceDbContext CreateDb(string connectionString, Guid tenantId)
    {
        var tenant = TestTenantContext.WithTenant(tenantId);
        return new PerformanceDbContext(
            new DbContextOptionsBuilder<PerformanceDbContext>()
                .UseNpgsql(connectionString)
                .AddInterceptors(new TenantSaveChangesInterceptor(tenant))
                .Options,
            tenant);
    }

    private static async Task CreateDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task DropDatabaseAsync(string baseConnectionString, string databaseName)
    {
        var admin = new NpgsqlConnectionStringBuilder(baseConnectionString) { Database = "postgres", Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using (var terminate = new NpgsqlCommand(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @databaseName AND pid <> pg_backend_pid();", connection))
        {
            terminate.Parameters.AddWithValue("databaseName", databaseName);
            await terminate.ExecuteNonQueryAsync();
        }
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{databaseName}\"", connection);
        await drop.ExecuteNonQueryAsync();
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class RelationalDatabaseFactAttribute : FactAttribute
{
    public RelationalDatabaseFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")))
            Skip = "Set FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION to run PostgreSQL integration coverage.";
    }
}
