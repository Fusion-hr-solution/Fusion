using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// Opt-in, idempotent development seed for the Atlas Performance progress demo. The complete
/// lifecycle is built through domain methods so a fresh database never needs follow-up repair SQL.
/// Enable with DemoSeed__AtlasPerformance__Enabled=true and provide the Atlas tenant id.
/// </summary>
public static class AtlasPerformanceDemoSeeder
{
    public const string CycleSlug = "atlas-progress-demo";

    private static readonly Guid EmployeeId = Guid.Parse("20000000-0000-0000-0000-000000000003");
    private static readonly Guid ManagerId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid ManagerUserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid EmployeeUserId = Guid.Parse("10000000-0000-0000-0000-000000000003");

    public static async Task SeedAsync(
        PerformanceDbContext db,
        Guid tenantId,
        DateTime asOfUtc,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("The Atlas tenant id is required.", nameof(tenantId));

        if (await db.PerformanceCycles.IgnoreQueryFilters()
                .AnyAsync(cycle => cycle.TenantId == tenantId && cycle.Slug == CycleSlug, cancellationToken))
            return;

        var year = asOfUtc.ToUniversalTime().Year;
        var opening = new DateTime(year, 1, 5, 9, 0, 0, DateTimeKind.Utc);
        var submissionDeadline = new DateTime(year, 1, 31, 17, 0, 0, DateTimeKind.Utc);
        var approvalDeadline = new DateTime(year, 2, 14, 17, 0, 0, DateTimeKind.Utc);
        var lockDate = new DateTime(year, 2, 15, 9, 0, 0, DateTimeKind.Utc);

        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            $"FY{year} Atlas progress demo",
            CycleSlug,
            year,
            "Locked objective baseline with representative progress states.",
            ManagerUserId,
            "Flit Manager",
            opening,
            submissionDeadline,
            approvalDeadline,
            lockDate,
            CampaignPlanningRulesSnapshot.Capture(
                5,
                "0.25,0.50",
                "Quantitative,Qualitative",
                ManagerUserId,
                opening));

        var strategic = cycle.AddStrategicObjective(
            "Improve client delivery quality",
            "Shared strategic outcome for the Atlas progress walkthrough.",
            "Advisory");
        cycle.Launch(
            [new ResolvedLaunchParticipant(
                EmployeeId,
                "Sami Analyst",
                ManagerId,
                "Flit Manager",
                false,
                null,
                "SAMI-001",
                "sami.analyst@atlas.example",
                null,
                "Advisory",
                "Analyst",
                ManagerId,
                "Flit Manager")],
            opening.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, opening.AddDays(2));
        var objectives = new[]
        {
            plan.AddObjective(cycle, "Reduce delivery defects", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 25, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Quantitative", "Delivery quality score", "95", "%", opening.AddDays(2)),
            plan.AddObjective(cycle, "Complete control reviews", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 25, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Quantitative", "Reviews completed", "12", "reviews", opening.AddDays(2)),
            plan.AddObjective(cycle, "Coach junior consultants", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 25, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Qualitative", null, null, null, opening.AddDays(2),
                successCriteria: "Monthly coaching is documented and acknowledged."),
            plan.AddObjective(cycle, "Publish a reusable delivery playbook", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 25, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Qualitative", null, null, null, opening.AddDays(2),
                successCriteria: "The playbook is accepted by the Advisory leadership team."),
        };

        var submission = plan.Submit(cycle, participant, opening.AddDays(10));
        if (!submission.Succeeded)
            throw new InvalidOperationException("The declarative Atlas plan is invalid: " +
                string.Join("; ", submission.BlockingReasons.Select(reason => reason.Message)));

        plan.Approve(new EmployeeObjectivePlanReviewActor(ManagerId, "Flit Manager"), opening.AddDays(11));
        cycle.LockPlanning(ManagerUserId, "Flit Manager", lockDate);

        AddProgress(db, plan.RecordProgress(cycle, objectives[0].Id, 100, null, "95/95", "Target sustained.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(40)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[1].Id, 70, null, "8/12", "Initial review wave complete.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(55)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[1].Id, 50, 70, "6/12", null,
            true, "Two reviews were reopened after the quality audit.",
            new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(85)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[2].Id, 25, null, null, "Monthly coaching started.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(65)));

        SeedCheckInScenario(db, cycle, plan, objectives[1], lockDate);

        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.Add(plan);
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Builds the end-to-end check-in walkthrough on top of the setback objective: the employee raises a
    /// `Needs discussion` signal, the reviewer plans a check-in linking that objective and signal,
    /// completes it with a shared summary and two agreed follow-up actions, the completion resolves the
    /// signal, the employee posts their one-time response, and then completes their own follow-up action.
    /// Every step runs through domain methods so the demo state is exactly what production would produce.
    /// </summary>
    private static void SeedCheckInScenario(
        PerformanceDbContext db,
        PerformanceCycle cycle,
        EmployeeObjectivePlan plan,
        EmployeeObjective setbackObjective,
        DateTime lockDate)
    {
        // 1. The employee flags the objective that regressed after the audit.
        var signal = ObjectiveDiscussionSignal.Raise(
            cycle.TenantId, cycle.Id, plan.Id, setbackObjective.Id, EmployeeId,
            setbackObjective.Title, "Sami Analyst",
            "The reopened reviews put this at risk — I'd like to align on scope.",
            lockDate.AddDays(86));

        // 2. The reviewer plans a check-in that links the objective and picks up the open signal.
        var checkIn = PerformanceCheckIn.Plan(
            cycle.TenantId, cycle.Id, EmployeeId, ManagerId, "Flit Manager", "Approver",
            lockDate.AddDays(90), "10:30", "Realign on the control-review setback",
            "Review reopened items and agree on a recovery plan.", lockDate.AddDays(87));
        checkIn.AddLinkedObjective(setbackObjective.Id, setbackObjective.Title);
        signal.LinkToCheckIn(checkIn.Id);

        // 3. The reviewer completes it with a shared summary and two agreed follow-up actions.
        checkIn.Complete(
            "We agreed the two reopened reviews slipped due to audit findings, not delivery. "
            + "Sami will re-plan the remaining reviews; I will secure an extra reviewer for two weeks.",
            [new CheckInDiscussedObjective(setbackObjective.Id, setbackObjective.Title)],
            ManagerId, "Flit Manager", lockDate.AddDays(92));

        var employeeAction = CheckInFollowUpAction.Create(
            cycle.TenantId, cycle.Id, checkIn.Id, EmployeeId,
            "Re-sequence the remaining control reviews and share the updated plan.",
            FollowUpActionOwnerKind.Employee, EmployeeId, "Sami Analyst",
            lockDate.AddDays(100), setbackObjective.Id, lockDate.AddDays(92));
        var reviewerAction = CheckInFollowUpAction.Create(
            cycle.TenantId, cycle.Id, checkIn.Id, EmployeeId,
            "Secure an additional reviewer for two weeks.",
            FollowUpActionOwnerKind.Reviewer, ManagerId, "Flit Manager",
            lockDate.AddDays(105), setbackObjective.Id, lockDate.AddDays(92));

        // 4. Completing the check-in resolves the linked discussion signal.
        signal.ResolveByCheckIn(checkIn.Id, lockDate.AddDays(92));

        // 5. The employee posts their single, immutable response, then completes their own action.
        checkIn.AddEmployeeResponse(EmployeeId, "Sami Analyst",
            "Thanks — recovery plan makes sense. I'll have the re-sequenced schedule out this week.",
            lockDate.AddDays(93));
        employeeAction.Complete(EmployeeId, "Sami Analyst",
            "Updated schedule shared with the team.", lockDate.AddDays(98));

        db.ObjectiveDiscussionSignals.Add(signal);
        db.PerformanceCheckIns.Add(checkIn);
        db.CheckInFollowUpActions.AddRange(employeeAction, reviewerAction);
    }

    private static void AddProgress(PerformanceDbContext db, ObjectiveProgressRecordResult result)
    {
        if (!result.Succeeded || result.Update is null)
            throw new InvalidOperationException("The declarative Atlas progress history is invalid.");
        db.ObjectiveProgressUpdates.Add(result.Update);
    }
}
