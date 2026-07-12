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
}
