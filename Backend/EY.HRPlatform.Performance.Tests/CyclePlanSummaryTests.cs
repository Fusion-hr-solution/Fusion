using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Tests.TestHelpers;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Administration's cycle-wide plan standing counts every participant exactly once, classified the same
/// way the manager roster classifies them, and reports execution as reporting / not reporting rather than
/// an averaged progress figure.
/// </summary>
public sealed class CyclePlanSummaryTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);
    private static readonly PlanSubmissionFacts Ready = new(1, true, 100m, true, false, true);

    [Fact]
    public async Task Counts_each_participant_by_plan_standing()
    {
        var store = TestStore.ForNewTenant();
        var tenant = store.TenantId;
        var manager = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", Start, End, Start.AddDays(30));

        var participants = new List<Participant>();
        var plans = new List<EmployeePlan>();
        var objectives = new List<Objective>();

        EmployeePlan PlanFor(string name, bool withProgress = false)
        {
            var employee = Guid.NewGuid();
            participants.Add(Participant.Create(tenant, cycle.Id, employee, name, null, null, null, manager, "Manager", false));
            var plan = EmployeePlan.Create(tenant, cycle.Id, Guid.NewGuid(), employee, name, null, manager, "Manager");
            var objective = Objective.CreateEmployee(tenant, cycle.Id, plan.Id, employee, $"{name} objective", null, null,
                Start, End, ObjectiveMeasurement.ManualPercentage(), 100m, null, null, Start, End);
            if (withProgress) objective.ApplyManualPercentage(40m);
            plans.Add(plan);
            objectives.Add(objective);
            return plan;
        }

        participants.Add(Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Not started", null, null, null, manager, "Manager", false));
        PlanFor("Drafting");
        var returned = PlanFor("Returned");
        returned.Submit(returned.EmployeeId, Ready);
        returned.Return(manager, "Sharpen the target.");
        var submitted = PlanFor("Submitted");
        submitted.Submit(submitted.EmployeeId, Ready);
        var quiet = PlanFor("Approved quiet");
        quiet.Submit(quiet.EmployeeId, Ready);
        quiet.Approve(manager);
        var reporting = PlanFor("Approved reporting", withProgress: true);
        reporting.Submit(reporting.EmployeeId, Ready);
        reporting.Approve(manager);

        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Participants.AddRange(participants);
            db.EmployeePlans.AddRange(plans);
            db.Objectives.AddRange(objectives);
            await db.SaveChangesAsync();
        }

        await using var read = store.NewContext();
        var result = await new GetCyclePlanSummaryHandler(read).Handle(new GetCyclePlanSummaryQuery(cycle.Id), default);

        Assert.True(result.IsSuccess);
        var summary = result.Value;
        Assert.Equal(6, summary.ParticipantCount);
        Assert.Equal(1, summary.NotStartedCount);
        Assert.Equal(1, summary.DraftCount);
        Assert.Equal(1, summary.ReturnedForChangesCount);
        Assert.Equal(1, summary.SubmittedCount);
        Assert.Equal(2, summary.ApprovedCount);
        Assert.Equal(1, summary.ApprovedReportingCount);
        Assert.Equal(1, summary.ApprovedNotReportingCount);
        Assert.Equal(0, summary.ParticipantsWithOverdueMilestones);
    }
}
