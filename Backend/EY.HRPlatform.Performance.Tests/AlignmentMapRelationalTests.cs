using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>The map's grouped personal-objective count translates and runs on PostgreSQL.</summary>
public sealed class AlignmentMapRelationalTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    [RelationalDatabaseFact]
    public async Task Personal_counts_by_status_come_from_put_forward_plans_on_postgres()
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
            var workforce = new FakeCoreWorkforceClient();
            var owner = workforce.Add("Coralie Ops").EmployeeId;
            var manager = workforce.Add("Nour Lead").EmployeeId;
            var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", Start, End, Start.AddDays(30)).Activated();
            var strategy = Objective.CreateStrategic(tenant, cycle.Id, "Grow the company", null, owner, Start, End,
                ObjectiveMeasurement.ManualPercentage(), Start, End);
            strategy.Publish();
            db.Cycles.Add(cycle);
            db.Objectives.Add(strategy);
            var ready = new PlanSubmissionFacts(1, true, 100m, true, false, PlanAlignmentPolicy.AtLeastOneConnected);
            foreach (var (status, state) in new (ObjectiveStatus?, PlanLifecycleState)[]
            {
                (ObjectiveStatus.OnTrack, PlanLifecycleState.Approved),
                (ObjectiveStatus.OffTrack, PlanLifecycleState.Approved),
                (null, PlanLifecycleState.Submitted),
                (null, PlanLifecycleState.Draft),
            })
            {
                var employee = workforce.Add($"Person {Guid.NewGuid():N}").EmployeeId;
                var plan = EmployeePlan.Create(tenant, cycle.Id, Guid.NewGuid(), employee, "Person", null, manager, "Nour Lead");
                var objective = Objective.CreateEmployee(tenant, cycle.Id, plan.Id, employee, "Personal", null, strategy.Id,
                    Start, End, ObjectiveMeasurement.ManualPercentage(), 100m, Start, End, Start, End);
                if (state != PlanLifecycleState.Draft) plan.Submit(employee, ready);
                if (state == PlanLifecycleState.Approved) plan.Approve(manager);
                if (status is { } reported) objective.ReportStatus(reported, DateTime.UtcNow);
                db.EmployeePlans.Add(plan);
                db.Objectives.Add(objective);
            }
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();

            var result = await new GetAlignmentMapHandler(db, workforce)
                .Handle(new GetAlignmentMapQuery(cycle.Id, new GoalActorContext(owner, IsAdmin: false, HasOrgManageGrant: false)), default);

            Assert.True(result.IsSuccess);
            var personal = result.Value.Nodes.Single(node => node.Id == strategy.Id).Personal!;
            Assert.Equal(new PersonalAlignmentDto(3, 1, 0, 1, 1, 0), personal);
            Assert.DoesNotContain(result.Value.Nodes, node => node.Kind == AlignmentMapNodeKind.Personal);
        }
        finally { await RelationalTests.DropDatabaseAsync(baseConnection, databaseName); }
    }
}
