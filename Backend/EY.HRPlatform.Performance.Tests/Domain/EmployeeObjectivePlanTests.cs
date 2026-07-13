using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class EmployeeObjectivePlanTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static CampaignPlanningRulesSnapshot Snapshot()
        => CampaignPlanningRulesSnapshot.Capture(3, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start);

    private static (PerformanceCycle Cycle, PerformanceCycleParticipant Participant, CampaignStrategicObjective Strategic) LaunchedCycle()
    {
        var cycle = PerformanceCycle.CreateDraft(
            TenantId,
            "FY26 Planning",
            "fy26-planning",
            2026,
            "Set planning objectives",
            Guid.NewGuid(),
            "HR Admin",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(30),
            Snapshot());
        var strategic = cycle.AddStrategicObjective("Improve client delivery", "Raise delivery quality", "Consulting");
        var participantId = Guid.NewGuid();
        cycle.Launch(
            [new ResolvedLaunchParticipant(participantId, "Alice Employee", Guid.NewGuid(), "Mia Manager", false, null)],
            Start.AddDays(1));

        return (cycle, cycle.Participants.Single(p => p.EmployeeId == participantId), strategic);
    }

    private static EmployeeObjective AddValidObjective(
        EmployeeObjectivePlan plan,
        PerformanceCycle cycle,
        CampaignStrategicObjective strategic,
        DateTime now,
        int weight = 100,
        string targetValue = "60")
        => plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            weight,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            targetValue,
            "%",
            now);

    private static EmployeeObjectivePlanReviewActor ManagerActor(PerformanceCycleParticipant participant)
        => new(participant.ApproverEmployeeId, participant.ApproverName);

    [Fact]
    public void AddObjective_AllowsIncompleteDraftObjective()
    {
        var (cycle, participant, _) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));

        var objective = plan.AddObjective(
            cycle,
            "  Improve delivery quality  ",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            Start.AddDays(2));

        Assert.Equal("Improve delivery quality", objective.Title);
        Assert.Null(objective.Weight);
        Assert.Null(objective.MeasurementMethod);
        Assert.Equal(PlanStatus.Draft, plan.Status);
    }

    [Fact]
    public void AddObjective_RejectsWeightOutsideFrozenMenu()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() => plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            30,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "60",
            "%",
            Start.AddDays(2)));
    }

    [Fact]
    public void CreateDraft_BeforePlanningOpening_Throws()
    {
        var (cycle, participant, _) = LaunchedCycle();

        Assert.Throws<DomainRuleViolationException>(() =>
            EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddMilliseconds(-1)));
    }

    [Fact]
    public void AddObjective_RejectsDisabledMeasurementMethod()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() => plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            25,
            Start.AddDays(10),
            "Milestones",
            null,
            null,
            null,
            Start.AddDays(2)));
    }

    [Fact]
    public void AddObjective_RejectsObjectiveCountAboveFrozenMaximum()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));

        for (var i = 0; i < 3; i++)
        {
            plan.AddObjective(
                cycle,
                $"Objective {i + 1}",
                ObjectiveAlignmentType.StrategicObjective,
                strategic.Id,
                strategic.Title,
                25,
                Start.AddDays(10),
                "Quantitative",
                null,
                null,
                null,
                Start.AddDays(2));
        }

        Assert.Throws<DomainRuleViolationException>(() => plan.AddObjective(
            cycle,
            "One too many",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            25,
            Start.AddDays(10),
            "Quantitative",
            null,
            null,
            null,
            Start.AddDays(2)));
    }

    [Fact]
    public void Submit_ReturnsBlockingReasonsAndKeepsDraftWhenPlanIsIncomplete()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            75,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            null,
            "%",
            Start.AddDays(2));

        var result = plan.Submit(cycle, participant, Start.AddDays(3));

        Assert.False(result.Succeeded);
        Assert.Equal(PlanStatus.Draft, plan.Status);
        Assert.Contains(result.BlockingReasons, reason => reason.Code == "Weight.TotalMustEqual100");
        Assert.Contains(result.BlockingReasons, reason => reason.Code == "Objective.TargetValueRequired");
    }

    [Fact]
    public void Submit_BlocksMissingAlignment()
    {
        var (cycle, participant, _) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(
            cycle,
            "Improve delivery quality",
            null,
            null,
            null,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "60",
            "%",
            Start.AddDays(2));

        var result = plan.Submit(cycle, participant, Start.AddDays(3));

        Assert.False(result.Succeeded);
        Assert.Contains(result.BlockingReasons, reason => reason.Code == "Objective.AlignmentRequired");
    }

    [Fact]
    public void Submit_BlocksQualitativeObjectiveWithoutSuccessCriteria()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Qualitative",
            null,
            null,
            null,
            Start.AddDays(2));

        var result = plan.Submit(cycle, participant, Start.AddDays(3));

        Assert.False(result.Succeeded);
        Assert.Contains(result.BlockingReasons, reason => reason.Code == "Objective.SuccessCriteriaRequired");
    }

    [Fact]
    public void Submit_WithValidPlan_StampsSubmittedAndFrozenApproverHandoff()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "60",
            "%",
            Start.AddDays(2));

        var result = plan.Submit(cycle, participant, Start.AddDays(3));

        Assert.True(result.Succeeded);
        Assert.Equal(PlanStatus.Submitted, plan.Status);
        Assert.Equal(Start.AddDays(3), plan.SubmittedAt);
        Assert.Equal(participant.ApproverEmployeeId, plan.ApproverEmployeeId);
        Assert.Equal(participant.ApproverName, plan.ApproverName);
        var reviewEvent = Assert.Single(plan.ReviewEvents);
        Assert.Equal(ReviewEventType.Submitted, reviewEvent.Type);
        Assert.Equal(participant.EmployeeId, reviewEvent.ActorEmployeeId);
        Assert.Equal(participant.FullName, reviewEvent.ActorName);
    }

    [Fact]
    public void Mutations_AfterSubmit_AreRejected()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var objective = plan.AddObjective(
            cycle,
            "Improve delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "60",
            "%",
            Start.AddDays(2));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);

        Assert.Throws<DomainRuleViolationException>(() => plan.RemoveObjective(objective.Id, Start.AddDays(4)));
        Assert.Throws<DomainRuleViolationException>(() => plan.UpdateObjective(
            cycle,
            objective.Id,
            "Updated",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "65",
            "%",
            Start.AddDays(4)));
    }

    [Fact]
    public void RequestChanges_RequiresSubmittedPlanAndComment()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        AddValidObjective(plan, cycle, strategic, Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() =>
            plan.RequestChanges(ManagerActor(participant), "Add a measurable delivery target.", Start.AddDays(3)));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        Assert.Throws<DomainRuleViolationException>(() =>
            plan.RequestChanges(ManagerActor(participant), "   ", Start.AddDays(4)));
    }

    [Fact]
    public void RequestChanges_ReturnsPlanForCorrectionAndLogsComment()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var objective = AddValidObjective(plan, cycle, strategic, Start.AddDays(2));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);

        plan.RequestChanges(
            ManagerActor(participant),
            "Add a stronger target value.",
            Start.AddDays(4),
            [objective.Id]);
        plan.UpdateObjective(
            cycle,
            objective.Id,
            "Updated delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "65",
            "%",
            Start.AddDays(5));

        Assert.Equal(PlanStatus.ChangesRequested, plan.Status);
        Assert.Equal("Add a stronger target value.", plan.LastChangeRequestComment);
        Assert.Equal(["Submitted", "ChangesRequested"], plan.ReviewEvents.Select(item => item.Type.ToString()));
        Assert.Equal([objective.Id], plan.ReviewEvents.Last().ReferencedObjectiveIds);
        Assert.Equal("65", plan.Objectives.Single().TargetValue);
    }

    [Fact]
    public void RequestChanges_RejectsObjectiveReferencesOutsidePlan()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        AddValidObjective(plan, cycle, strategic, Start.AddDays(2));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);

        Assert.Throws<DomainRuleViolationException>(() =>
            plan.RequestChanges(
                ManagerActor(participant),
                "Fix an unrelated objective.",
                Start.AddDays(4),
                [Guid.NewGuid()]));
    }

    [Fact]
    public void Resubmit_FromChangesRequested_RevalidatesAndRecordsResubmission()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var objective = AddValidObjective(plan, cycle, strategic, Start.AddDays(2));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        plan.RequestChanges(ManagerActor(participant), "Fix the total weight.", Start.AddDays(4));
        plan.UpdateObjective(
            cycle,
            objective.Id,
            "Updated delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            75,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "65",
            "%",
            Start.AddDays(5));

        var blocked = plan.Submit(cycle, participant, Start.AddDays(6));

        Assert.False(blocked.Succeeded);
        Assert.Equal(PlanStatus.ChangesRequested, plan.Status);
        Assert.Contains(blocked.BlockingReasons, reason => reason.Code == "Weight.TotalMustEqual100");

        plan.UpdateObjective(
            cycle,
            objective.Id,
            "Updated delivery quality",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            Start.AddDays(10),
            "Quantitative",
            "NPS",
            "65",
            "%",
            Start.AddDays(7));

        var resubmitted = plan.Submit(cycle, participant, Start.AddDays(8));

        Assert.True(resubmitted.Succeeded);
        Assert.Equal(PlanStatus.Submitted, plan.Status);
        Assert.Equal(Start.AddDays(8), plan.SubmittedAt);
        Assert.Equal(["Submitted", "ChangesRequested", "Resubmitted"], plan.ReviewEvents.Select(item => item.Type.ToString()));
    }

    [Fact]
    public void Approve_RequiresSubmittedPlanAndIsTerminal()
    {
        var (cycle, participant, strategic) = LaunchedCycle();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var objective = AddValidObjective(plan, cycle, strategic, Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() => plan.Approve(ManagerActor(participant), Start.AddDays(3)));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);

        plan.Approve(ManagerActor(participant), Start.AddDays(4), "Ready for evaluation.");

        Assert.Equal(PlanStatus.Approved, plan.Status);
        Assert.Equal(participant.ApproverEmployeeId, plan.ApprovingManagerEmployeeId);
        Assert.Equal(participant.ApproverName, plan.ApprovingManagerName);
        Assert.Equal(Start.AddDays(4), plan.ApprovedAt);
        Assert.Throws<DomainRuleViolationException>(() => plan.RemoveObjective(objective.Id, Start.AddDays(5)));
        Assert.Throws<DomainRuleViolationException>(() => plan.RequestChanges(ManagerActor(participant), "Attempt after approval", Start.AddDays(5)));
        Assert.Throws<DomainRuleViolationException>(() => plan.Approve(ManagerActor(participant), Start.AddDays(5)));
        Assert.Equal(["Submitted", "Approved"], plan.ReviewEvents.Select(item => item.Type.ToString()));
    }
}
