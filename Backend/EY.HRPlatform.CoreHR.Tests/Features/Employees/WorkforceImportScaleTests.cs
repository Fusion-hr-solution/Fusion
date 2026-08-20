using System.Diagnostics;
using System.Text;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

/// <summary>
/// Early representative Apply scale measurement on real PostgreSQL. Reports measured behavior only —
/// no invented SLA. Gated behind FUSION_COREHR_SCALE_TEST=1 (in addition to the relational
/// connection) so it does not run in the normal suite.
/// </summary>
public sealed class WorkforceImportScaleTests(ITestOutputHelper output)
{
    private static readonly WorkforceImportActor Actor = new(Guid.NewGuid(), "Scale");

    [ScaleFact] public Task Apply_1000() => MeasureAsync(1000);
    [ScaleFact] public Task Apply_5000() => MeasureAsync(5000);
    [ScaleFact] public Task Apply_10000() => MeasureAsync(10000);

    private async Task MeasureAsync(int count)
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_corehr_scale_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        try
        {
            await CreateDatabaseAsync(baseConnection, databaseName);
            var tenantId = Guid.NewGuid();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            await using (var db = Db(connectionString, tenantId)) await db.Database.MigrateAsync();
            await using (var db = Db(connectionString, tenantId))
            {
                var org = new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(tenantId));
                await org.GetTypesAsync(default);
                var root = await org.CreateRootAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationRootRequest("ASTERIA", "Asteria", today), default);
                await org.CreateUnitAsync(new EY.HRPlatform.CoreHR.Features.Organization.CreateOrganizationUnitRequest(
                    "OPS", "Operations", EY.HRPlatform.CoreHR.Domain.Entities.OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
            }

            // Primary establishment characterization: Employee + Employment + primary WorkAssignment
            // per row (~half manual number, ~half generated → exercises the bulk allocator). A small
            // bounded set (rows 20-40) references a same-import manager so pass-2 is exercised without
            // routing a per-row canonical manager write through the seam for every employee — that
            // manager-dense path is a documented O(n) probe per row (see design risk), not the
            // establishment baseline this gate measures.
            var csv = new StringBuilder("Employee Number,First Name,Last Name,Employment Start,Organization,Title,Manager\n");
            for (var i = 0; i < count; i++)
            {
                var number = i % 2 == 0 ? $"M-{i:D6}" : "";
                var manager = i is >= 20 and < 40 ? "M-000000" : "";
                csv.Append(number).Append(",First").Append(i).Append(",Last").Append(i)
                    .Append(",2021-02-01,OPS,Consultant,").Append(manager).Append('\n');
            }

            Guid sessionId;
            await using (var db = Db(connectionString, tenantId))
                sessionId = (await Session(db, tenantId).IntakeAsync(new WorkforceImportIntakeRequest(
                    Guid.NewGuid(), today, new MemoryStream(Encoding.UTF8.GetBytes(csv.ToString())), "scale.csv", "text/csv", null, Actor), default)).Session!.Id;

            var reviewSw = Stopwatch.StartNew();
            await using (var db = Db(connectionString, tenantId))
            {
                var current = await db.WorkforceImportSessions.AsNoTracking().SingleAsync(s => s.Id == sessionId);
                await Review(db, tenantId).RecomputeAndSaveAsync(sessionId, current.Version, Actor, default);
            }
            reviewSw.Stop();

            var applySw = Stopwatch.StartNew();
            await using (var db = Db(connectionString, tenantId))
            {
                var session = await db.WorkforceImportSessions.SingleAsync(s => s.Id == sessionId);
                session.BeginApply(session.ReviewDigest ?? "", Actor);
                await db.SaveChangesAsync();
            }
            await using (var db = Db(connectionString, tenantId))
                await Apply(db, tenantId).ExecuteAsync(sessionId, Actor, null, default);
            applySw.Stop();

            int employees, managerLinks;
            await using (var db = Db(connectionString, tenantId))
            {
                employees = await db.Employees.CountAsync();
                managerLinks = await db.ManagerRelationships.CountAsync(m => m.EffectiveTo == null);
            }
            Assert.Equal(count, employees);

            output.WriteLine($"[scale {count}] review={reviewSw.ElapsedMilliseconds}ms apply={applySw.ElapsedMilliseconds}ms " +
                $"apply-per-employee={(double)applySw.ElapsedMilliseconds / count:F2}ms employees={employees} managerLinks={managerLinks}");
        }
        finally { await DropDatabaseAsync(baseConnection, databaseName); }
    }

    private static WorkforceImportSessionService Session(CoreHRDbContext db, Guid t)
        => new(db, TestTenantContext.WithTenant(t), new SafeTabularSourceReader(), new WorkforceImportSourceAdapter());
    private static WorkforceImportReviewService Review(CoreHRDbContext db, Guid t)
        => new(db, TestTenantContext.WithTenant(t), new WorkforceImportInterpreter(), new WorkforceImportResolver(),
            new WorkforceImportSnapshotLoader(db, new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, TestTenantContext.WithTenant(t))));
    private static WorkforceImportApplyOrchestrator Apply(CoreHRDbContext db, Guid t)
    {
        var tc = TestTenantContext.WithTenant(t);
        return new(db, tc, new WorkforceImportInterpreter(), new WorkforceImportResolver(),
            new WorkforceImportSnapshotLoader(db, new EY.HRPlatform.CoreHR.Features.Organization.OrganizationService(db, tc)),
            new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceMutationService(db, tc, new EY.HRPlatform.CoreHR.Features.Workforce.Services.WorkforceCanonicalResolver(db)),
            new EY.HRPlatform.CoreHR.Features.Workforce.Services.EmployeeNumberAllocatorService(db, tc));
    }
    private static CoreHRDbContext Db(string cs, Guid t) => new(new DbContextOptionsBuilder<CoreHRDbContext>().UseNpgsql(cs).Options, TestTenantContext.WithTenant(t));

    private static async Task CreateDatabaseAsync(string b, string n)
    {
        await using var c = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(b) { Database = "postgres", Pooling = false }.ConnectionString);
        await c.OpenAsync(); await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{n}\"", c); await cmd.ExecuteNonQueryAsync();
    }
    private static async Task DropDatabaseAsync(string b, string n)
    {
        await using var c = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(b) { Database = "postgres", Pooling = false }.ConnectionString);
        await c.OpenAsync();
        await using (var t = new NpgsqlCommand("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=@n AND pid<>pg_backend_pid();", c)) { t.Parameters.AddWithValue("n", n); await t.ExecuteNonQueryAsync(); }
        await using var d = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{n}\"", c); await d.ExecuteNonQueryAsync();
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class ScaleFactAttribute : FactAttribute
{
    public ScaleFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FUSION_COREHR_RELATIONAL_TEST_CONNECTION"))
            || Environment.GetEnvironmentVariable("FUSION_COREHR_SCALE_TEST") != "1")
            Skip = "Set FUSION_COREHR_SCALE_TEST=1 (and the relational connection) to run Apply scale measurement.";
    }
}
