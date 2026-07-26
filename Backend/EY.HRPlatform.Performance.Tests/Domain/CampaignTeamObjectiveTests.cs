using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class CampaignTeamObjectiveTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static CampaignPlanningRulesSnapshot Snapshot()
        => CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start);

    private static PerformanceCycle DraftWithStrategy(out CampaignStrategicObjective strategicObjective)
    {
        var cycle = PerformanceCycle.CreateDraft(
            TenantId, "FY26 Planning", "fy26-planning", 2026, "Set planning objectives",
            Guid.NewGuid(), "HR Admin",
            Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(30), Snapshot());
        strategicObjective = cycle.AddStrategicObjective("Improve client delivery", "Raise delivery quality", "Consulting");
        return cycle;
    }

    private static PerformanceCycle LaunchedCycle(out CampaignStrategicObjective strategicObjective)
    {
        var cycle = DraftWithStrategy(out strategicObjective);
        var baseline = new[]
        {
            new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", Guid.NewGuid(), "Alice's approver", false, null)
        };
        cycle.Launch(baseline, Start.AddDays(2));
        return cycle;
    }

    [Fact]
    public void Create_OnLaunchedCampaign_SavesWithoutAnyLifecycleState()
    {
        var ownerId = Guid.NewGuid();
        var cycle = LaunchedCycle(out var strategic);

        var objective = CampaignTeamObjective.Create(
            cycle, strategic, ownerId, "  Mia Manager  ",
            "  Raise delivery NPS  ", "NPS above 60 by Q4", "Quantitative", "  ");

        Assert.Equal(TenantId, objective.TenantId);
        Assert.Equal(cycle.Id, objective.CycleId);
        Assert.Equal(strategic.Id, objective.StrategicObjectiveId);
        Assert.Equal(ownerId, objective.OwnerManagerEmployeeId);
        Assert.Equal("Mia Manager", objective.OwnerManagerName);
        Assert.Equal("Raise delivery NPS", objective.Title);
        Assert.Equal("NPS above 60 by Q4", objective.SuccessCriteria);
        Assert.Equal("Quantitative", objective.MeasurementMethod);
        Assert.Null(objective.Description);
    }

    [Fact]
    public void Create_NormalizesMeasurementMethodToSnapshotToken()
    {
        var cycle = LaunchedCycle(out var strategic);

        var objective = CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", " qualitative ", null);

        Assert.Equal("Qualitative", objective.MeasurementMethod);
    }

    [Fact]
    public void Create_OnDraftCampaign_Throws()
    {
        var cycle = DraftWithStrategy(out var strategic);

        Assert.Throws<DomainRuleViolationException>(() => CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null));
    }

    [Fact]
    public void Create_WithInactiveStrategicObjective_Throws()
    {
        var cycle = DraftWithStrategy(out var strategic);
        var second = cycle.AddStrategicObjective("Second pillar", null, null);
        cycle.SetStrategicObjectiveActive(strategic.Id, false);
        cycle.Launch(
            [new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", Guid.NewGuid(), "Approver", false, null)],
            Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() => CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null));

        // The active one still works.
        var objective = CampaignTeamObjective.Create(
            cycle, second, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null);
        Assert.Equal(second.Id, objective.StrategicObjectiveId);
    }

    [Fact]
    public void Create_WithStrategicObjectiveOfAnotherCampaign_Throws()
    {
        var cycle = LaunchedCycle(out _);
        LaunchedCycle(out var foreignStrategic);

        Assert.Throws<DomainRuleViolationException>(() => CampaignTeamObjective.Create(
            cycle, foreignStrategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null));
    }

    [Fact]
    public void Create_WithMeasurementMethodOutsideSnapshot_Throws()
    {
        var cycle = LaunchedCycle(out var strategic);

        Assert.Throws<DomainRuleViolationException>(() => CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Milestones", null));
    }

    [Theory]
    [InlineData("", "NPS above 60", "Quantitative")]
    [InlineData("Raise delivery NPS", " ", "Quantitative")]
    [InlineData("Raise delivery NPS", "NPS above 60", "")]
    public void Create_WithMissingRequiredField_Throws(string title, string successCriteria, string measurementMethod)
    {
        var cycle = LaunchedCycle(out var strategic);

        Assert.Throws<ArgumentException>(() => CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            title, successCriteria, measurementMethod, null));
    }

    [Fact]
    public void Create_WithoutOwner_Throws()
    {
        var cycle = LaunchedCycle(out var strategic);

        Assert.Throws<ArgumentException>(() => CampaignTeamObjective.Create(
            cycle, strategic, Guid.Empty, "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null));
    }

    [Fact]
    public void Update_AppliesChanges_AndKeepsOwnerImmutable()
    {
        var ownerId = Guid.NewGuid();
        var cycle = DraftWithStrategy(out var strategic);
        var second = cycle.AddStrategicObjective("Second pillar", null, null);
        cycle.Launch(
            [new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", Guid.NewGuid(), "Approver", false, null)],
            Start.AddDays(2));

        var objective = CampaignTeamObjective.Create(
            cycle, strategic, ownerId, "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null);

        objective.Update(cycle, second, "Improve retention", "Attrition under 8%", "Qualitative", "Team-wide focus");

        Assert.Equal(second.Id, objective.StrategicObjectiveId);
        Assert.Equal("Improve retention", objective.Title);
        Assert.Equal("Attrition under 8%", objective.SuccessCriteria);
        Assert.Equal("Qualitative", objective.MeasurementMethod);
        Assert.Equal("Team-wide focus", objective.Description);
        Assert.Equal(ownerId, objective.OwnerManagerEmployeeId);
    }

    [Fact]
    public void Update_WithAnotherCampaign_Throws()
    {
        var cycle = LaunchedCycle(out var strategic);
        var otherCycle = LaunchedCycle(out var otherStrategic);

        var objective = CampaignTeamObjective.Create(
            cycle, strategic, Guid.NewGuid(), "Mia Manager",
            "Raise delivery NPS", "NPS above 60", "Quantitative", null);

        Assert.Throws<DomainRuleViolationException>(() =>
            objective.Update(otherCycle, otherStrategic, "Improve retention", "Attrition under 8%", "Quantitative", null));
    }

    [Fact]
    public void ParseEnabledMeasurementMethods_ReturnsSnapshotTokens()
    {
        var cycle = LaunchedCycle(out _);

        var methods = CampaignTeamObjective.ParseEnabledMeasurementMethods(cycle);

        Assert.Equal(["Quantitative", "Qualitative"], methods);
    }
}
