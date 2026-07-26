using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCycleTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static CampaignPlanningRulesSnapshot Snapshot()
        => CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), Start);

    private static PerformanceCycle NewCampaignDraft(DateTime? openingDate = null)
    {
        var opening = openingDate ?? Start;
        return PerformanceCycle.CreateDraft(
            TenantId,
            "FY26 Planning",
            "fy26-planning",
            opening.Year,
            "Set planning objectives",
            Guid.NewGuid(),
            "HR Admin",
            opening,
            opening.AddDays(14),
            opening.AddDays(21),
            opening.AddDays(30),
            Snapshot());
    }

    /// <summary>A draft that is complete enough to launch (active strategic objective present).</summary>
    private static PerformanceCycle CompleteDraft(DateTime? openingDate = null)
    {
        var cycle = NewCampaignDraft(openingDate);
        cycle.AddStrategicObjective("Improve client delivery", "Raise delivery quality", "Consulting");
        return cycle;
    }

    private static ResolvedLaunchParticipant Participant(
        string name,
        Guid? approverId = null,
        bool overridden = false,
        string? overrideReason = null)
        => new(
            Guid.NewGuid(),
            name,
            approverId ?? Guid.NewGuid(),
            $"{name}'s approver",
            overridden,
            overrideReason);

    [Fact]
    public void CreateDraft_WithValidSchedule_StartsAsEditableDraft()
    {
        var cycle = NewCampaignDraft();

        Assert.Equal(PerformanceCycleStatus.Draft, cycle.Status);
        Assert.True(cycle.IsEditable);
        Assert.Equal(TenantId, cycle.TenantId);
        Assert.Equal(2026, cycle.ReferenceYear);
        Assert.Equal(Start, cycle.PlanningOpeningDate);
        Assert.NotNull(cycle.PlanningRulesSnapshot);
    }

    [Fact]
    public void CreateDraft_WithOutOfOrderSchedule_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            PerformanceCycle.CreateDraft(
                TenantId, "FY26 Planning", "fy26-planning", 2026, null,
                Guid.NewGuid(), "HR Admin",
                Start, Start.AddDays(14), Start.AddDays(7), Start.AddDays(30), Snapshot()));
    }

    [Fact]
    public void PlanningRulesSnapshot_IsCapturedAndReadOnly()
    {
        var snapshot = Snapshot();
        var cycle = PerformanceCycle.CreateDraft(
            TenantId, "FY26 Planning", "fy26-planning", 2026, null,
            Guid.NewGuid(), "HR Admin",
            Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(30), snapshot);

        cycle.UpdateDraftDetails("FY26 Planning Updated", 2026, "Updated",
            Start, Start.AddDays(10), Start.AddDays(20), Start.AddDays(30));

        Assert.Same(snapshot, cycle.PlanningRulesSnapshot);
    }

    [Fact]
    public void StrategicObjectiveLifecycle_UpdatesActiveStateAndCompleteness()
    {
        var cycle = NewCampaignDraft();

        var initial = cycle.EvaluateDraftCompleteness();
        Assert.False(initial.IsComplete);
        Assert.Contains(initial.BlockingReasons, reason => reason.Contains("active strategic objective"));

        var objective = cycle.AddStrategicObjective("Improve client delivery", "Raise delivery quality", "Consulting");
        Assert.True(cycle.EvaluateDraftCompleteness().IsComplete);

        cycle.SetStrategicObjectiveActive(objective.Id, false);
        Assert.False(cycle.EvaluateDraftCompleteness().IsComplete);
    }

    [Fact]
    public void Launch_FreezesParticipantAndApproverBaseline_AndTransitionsToLaunched()
    {
        var cycle = CompleteDraft();
        var approverId = Guid.NewGuid();
        var baseline = new[] { Participant("Alice", approverId), Participant("Bob") };

        cycle.Launch(baseline, Start.AddDays(2));

        Assert.Equal(PerformanceCycleStatus.Launched, cycle.Status);
        Assert.NotNull(cycle.LaunchedAt);
        Assert.False(cycle.IsEditable);
        Assert.Equal(2, cycle.Participants.Count);
        var alice = cycle.Participants.Single(p => p.FullName == "Alice");
        Assert.Equal(approverId, alice.ApproverEmployeeId);
    }

    [Fact]
    public void Launch_CapturesDefaultAndOverriddenApprovers()
    {
        var cycle = CompleteDraft();
        var baseline = new[]
        {
            Participant("Default", overridden: false),
            Participant("Overridden", overridden: true, overrideReason: "Manager on leave")
        };

        cycle.Launch(baseline, Start.AddDays(2));

        Assert.False(cycle.Participants.Single(p => p.FullName == "Default").IsApproverOverridden);
        var overridden = cycle.Participants.Single(p => p.FullName == "Overridden");
        Assert.True(overridden.IsApproverOverridden);
        Assert.Equal("Manager on leave", overridden.ApproverOverrideReason);
    }

    [Fact]
    public void Launch_WithEmptyPopulation_Throws()
    {
        var cycle = CompleteDraft();
        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.Launch([], Start.AddDays(2)));
    }

    [Fact]
    public void Launch_WithParticipantMissingApprover_Throws()
    {
        var cycle = CompleteDraft();
        var baseline = new[] { new ResolvedLaunchParticipant(Guid.NewGuid(), "No Approver", Guid.Empty, "", false, null) };

        Assert.Throws<DomainRuleViolationException>(() => cycle.Launch(baseline, Start.AddDays(2)));
    }

    [Fact]
    public void Launch_WithNoActiveStrategicObjective_Throws()
    {
        var cycle = NewCampaignDraft(); // no strategic objective added
        var baseline = new[] { Participant("Alice") };

        Assert.Throws<DomainRuleViolationException>(() => cycle.Launch(baseline, Start.AddDays(2)));
    }

    [Fact]
    public void Launch_WhenAlreadyLaunched_Throws()
    {
        var cycle = CompleteDraft();
        cycle.Launch([Participant("Alice")], Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() => cycle.Launch([Participant("Bob")], Start.AddDays(3)));
    }

    [Fact]
    public void Launch_IsAllowedBeforeThePlanningOpeningDate()
    {
        var futureOpening = Start.AddYears(1);
        var cycle = CompleteDraft(futureOpening);

        cycle.Launch([Participant("Alice")], Start);

        Assert.Equal(PerformanceCycleStatus.Launched, cycle.Status);
        Assert.Equal(futureOpening, cycle.PlanningOpeningDate);
    }

    [Fact]
    public void DraftEdits_AreRejectedAfterLaunch()
    {
        var cycle = CompleteDraft();
        cycle.Launch([Participant("Alice")], Start.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.UpdateDraftDetails("New", 2026, null, Start, Start.AddDays(1), Start.AddDays(2), Start.AddDays(3)));
        Assert.Throws<DomainRuleViolationException>(() => cycle.SetPopulation(false, []));
    }

    [Fact]
    public void LockPlanning_RecordsExplicitPlanningLockMetadata()
    {
        var cycle = CompleteDraft();
        var actorId = Guid.NewGuid();
        cycle.Launch([Participant("Alice")], Start.AddDays(2));

        cycle.LockPlanning(actorId, "HR Admin", Start.AddDays(30));

        Assert.True(cycle.IsPlanningLocked);
        Assert.Equal(Start.AddDays(30), cycle.PlanningLockedAt);
        Assert.Equal(actorId, cycle.PlanningLockedByUserId);
        Assert.Equal("HR Admin", cycle.PlanningLockedByName);
        Assert.Equal(PerformanceCycleStatus.Launched, cycle.Status);
    }

    [Fact]
    public void LockPlanning_WhenAlreadyLocked_Throws()
    {
        var cycle = CompleteDraft();
        cycle.Launch([Participant("Alice")], Start.AddDays(2));
        cycle.LockPlanning(Guid.NewGuid(), "HR Admin", Start.AddDays(30));

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.LockPlanning(Guid.NewGuid(), "Other HR", Start.AddDays(31)));
    }
}
