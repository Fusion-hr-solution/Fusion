using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

public sealed class UpdateRequestRelationalTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);

    [RelationalDatabaseFact]
    public async Task One_open_request_per_target_is_enforced_by_the_database_and_the_migration_rolls_back()
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
            var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
            var lina = Guid.NewGuid();
            var participant = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Nour", null, null, null, lina, "Lina", false, Start);
            var plan = EmployeePlan.Create(tenant, cycle.Id, participant.Id, participant.EmployeeId, "Nour", null, lina, "Lina");
            plan.Submit(participant.EmployeeId, new PlanSubmissionFacts(1, true, 100m, true, false, PlanAlignmentPolicy.Optional));
            plan.Approve(lina);
            db.Cycles.Add(cycle);
            db.Participants.Add(participant);
            db.EmployeePlans.Add(plan);
            var first = UpdateRequest.Create(plan, null, lina, "Lina", null, DateTime.UtcNow);
            db.UpdateRequests.Add(first);
            await db.SaveChangesAsync();

            db.UpdateRequests.Add(UpdateRequest.Create(plan, null, lina, "Lina", "again", DateTime.UtcNow));
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();

            // Once resolved, the target can be asked again.
            var tracked = await db.UpdateRequests.SingleAsync();
            tracked.Withdraw(DateTime.UtcNow);
            db.UpdateRequests.Add(UpdateRequest.Create(plan, null, lina, "Lina", "new ask", DateTime.UtcNow));
            await db.SaveChangesAsync();
            Assert.Equal(2, await db.UpdateRequests.CountAsync());

            var migrations = db.Database.GetMigrations().ToArray();
            var index = Array.FindIndex(migrations, m => m.EndsWith("_AddUpdateRequests"));
            Assert.True(index > 0);
            await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync(migrations[index - 1]);
            Assert.Equal(0, await db.Database.SqlQueryRaw<int>("""
                SELECT count(*)::int AS "Value" FROM information_schema.tables
                WHERE table_schema='performance' AND table_name = 'UpdateRequests'
                """).SingleAsync());
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
    /// <summary>
    /// Two progress updates on different objectives race to satisfy one plan-level request. Both progress
    /// facts persist; the request is satisfied once, by the first commit, with one audit entry.
    /// </summary>
    [RelationalDatabaseFact]
    public async Task Concurrent_progress_under_one_plan_level_request_both_save_and_satisfy_it_once()
    {
        var baseConnection = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_RELATIONAL_TEST_CONNECTION")!;
        var databaseName = $"fusion_perf_{Guid.NewGuid():N}";
        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var tenant = Guid.NewGuid();
        try
        {
            await RelationalTests.CreateDatabaseAsync(baseConnection, databaseName);
            Guid requestId, cycleId, nour;
            var objectiveIds = new Guid[2];
            await using (var db = RelationalTests.CreateDb(connection, tenant))
            {
                await db.Database.MigrateAsync();
                var cycle = PerformanceCycle.CreateDraft(tenant, "FY26", Start, Start.AddYears(1).AddDays(-1), Start.AddDays(30)).Activated();
                var lina = Guid.NewGuid();
                var participant = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Nour", null, null, null, lina, "Lina", false, Start);
                var plan = EmployeePlan.Create(tenant, cycle.Id, participant.Id, participant.EmployeeId, "Nour", null, lina, "Lina");
                plan.Submit(participant.EmployeeId, new PlanSubmissionFacts(1, true, 100m, true, false, PlanAlignmentPolicy.Optional));
                plan.Approve(lina);
                var end = Start.AddYears(1).AddDays(-1);
                var objectives = Enumerable.Range(0, 2).Select(i => Objective.CreateStrategic(tenant, cycle.Id, $"Objective {i}", null,
                    participant.EmployeeId, Start, end, ObjectiveMeasurement.ManualPercentage(), Start, end)).ToArray();
                var request = UpdateRequest.Create(plan, null, lina, "Lina", null, DateTime.UtcNow.AddMinutes(-5));
                db.Cycles.Add(cycle);
                db.Participants.Add(participant);
                db.EmployeePlans.Add(plan);
                db.Objectives.AddRange(objectives);
                db.UpdateRequests.Add(request);
                await db.SaveChangesAsync();
                (requestId, cycleId, nour) = (request.Id, cycle.Id, participant.EmployeeId);
                objectiveIds[0] = objectives[0].Id; objectiveIds[1] = objectives[1].Id;
            }

            // Both writers read the request while it is still open, then commit one after the other.
            await using var first = RelationalTests.CreateDb(connection, tenant);
            await using var second = RelationalTests.CreateDb(connection, tenant);
            var updates = new ProgressUpdate[2];
            var contexts = new[] { first, second };
            for (var i = 0; i < 2; i++)
            {
                var db = contexts[i];
                updates[i] = ProgressUpdate.RecordPercentage(tenant, cycleId, objectiveIds[i], nour, 40 + i, null, false, false);
                db.ProgressUpdates.Add(updates[i]);
                var open = await db.UpdateRequests.SingleAsync(item => item.Id == requestId);
                Assert.True(open.SatisfyBy(updates[i].Id, updates[i].RecordedAt));
                db.AuditEntries.Add(PerformanceAuditEntry.Record(tenant, "UpdateRequest", requestId, cycleId,
                    PerformanceAuditActions.UpdateRequestSatisfied, new { progressUpdateId = updates[i].Id }, "nour", nour, $"c{i}"));
            }
            await UpdateRequestSatisfaction.SaveAsync(first, default);
            await UpdateRequestSatisfaction.SaveAsync(second, default);

            await using var check = RelationalTests.CreateDb(connection, tenant);
            Assert.Equal(2, await check.ProgressUpdates.CountAsync());
            var satisfied = await check.UpdateRequests.SingleAsync();
            Assert.Equal(UpdateRequestState.Satisfied, satisfied.State);
            Assert.Equal(updates[0].Id, satisfied.SatisfiedByProgressUpdateId);
            Assert.Equal(1, await check.AuditEntries.CountAsync(item => item.ResourceId == requestId
                && item.Action == PerformanceAuditActions.UpdateRequestSatisfied));
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
}
