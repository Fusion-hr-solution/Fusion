using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Domain;

/// <summary>
/// Closure is terminal (design D1): Draft -> Launched -> Closed, with no way back. A closed campaign
/// is the settled record of what a person was rated in that period.
/// </summary>
public sealed class PerformanceCycleClosureTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Actor = Guid.NewGuid();

    private static Performance.Domain.Entities.PerformanceCycle LaunchedCycle() => TestCycles
        .Create(Guid.NewGuid(), "FY26", PerformanceCycleType.Annual, Start, Start.AddYears(1),
            objectiveSettingDeadline: Start.AddDays(30))
        .ForceLaunched();

    [Fact]
    public void Closing_a_launched_campaign_records_actor_time_and_kind()
    {
        var cycle = LaunchedCycle();
        var closedAt = Start.AddMonths(11);

        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", closedAt);

        Assert.Equal(PerformanceCycleStatus.Closed, cycle.Status);
        Assert.True(cycle.IsClosed);
        Assert.False(cycle.IsOpen);
        Assert.Equal(closedAt, cycle.ClosedAt);
        Assert.Equal(Actor, cycle.ClosedByUserId);
        Assert.Equal("HR Admin", cycle.ClosedByName);
        Assert.Equal(CampaignClosureKind.Automatic, cycle.ClosureKind);
    }

    [Fact]
    public void A_manual_closure_is_distinguishable_from_an_automatic_one()
    {
        var cycle = LaunchedCycle();

        cycle.Close(CampaignClosureKind.Manual, Actor, "HR Admin", Start.AddMonths(6));

        Assert.Equal(CampaignClosureKind.Manual, cycle.ClosureKind);
    }

    [Fact]
    public void A_draft_campaign_is_deleted_not_closed()
    {
        var cycle = TestCycles.Create(
            Guid.NewGuid(), "FY26", PerformanceCycleType.Annual, Start, Start.AddYears(1),
            objectiveSettingDeadline: Start.AddDays(30));

        Assert.Equal(PerformanceCycleStatus.Draft, cycle.Status);

        var exception = Assert.Throws<DomainRuleViolationException>(
            () => cycle.Close(CampaignClosureKind.Manual, Actor, "HR Admin", Start.AddDays(5)));

        Assert.Contains("never launched", exception.Message);
        Assert.Equal(PerformanceCycleStatus.Draft, cycle.Status);
    }

    [Fact]
    public void Closure_is_terminal_and_cannot_be_repeated()
    {
        var cycle = LaunchedCycle();
        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", Start.AddMonths(11));

        Assert.Throws<DomainRuleViolationException>(
            () => cycle.Close(CampaignClosureKind.Manual, Actor, "HR Admin", Start.AddMonths(12)));
    }

    [Fact]
    public void A_closed_campaign_cannot_be_relaunched_or_locked()
    {
        var cycle = LaunchedCycle();
        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", Start.AddMonths(11));

        // Both transitions require Launched, so Closed is a genuine dead end rather than a label.
        Assert.Throws<DomainRuleViolationException>(
            () => cycle.LockPlanning(Actor, "HR Admin", Start.AddMonths(11)));
        Assert.Throws<DomainRuleViolationException>(
            () => cycle.Launch([], Start.AddMonths(11)));
    }

    [Fact]
    public void Closing_preserves_the_frozen_participant_baseline()
    {
        var cycle = LaunchedCycle();
        var participantsBefore = cycle.Participants.Count;

        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", Start.AddMonths(11));

        // An archive keeps its records: closure redacts and deletes nothing.
        Assert.Equal(participantsBefore, cycle.Participants.Count);
    }

    [Fact]
    public void A_closed_campaign_still_answers_read_paths()
    {
        var cycle = LaunchedCycle();
        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", Start.AddMonths(11));

        // Closure makes a campaign read-only, not unreadable. Detail workspaces gate on this, so a
        // regression here would turn every closed campaign's history into an error state — which is
        // exactly what rendering the closed workspace caught before this predicate existed.
        Assert.True(cycle.IsOpenOrClosed());

        // Sweeps and writes keep requiring Launched exactly, so they still exclude it.
        Assert.False(cycle.IsOpen);
    }

    [Fact]
    public void A_draft_campaign_answers_neither_read_nor_sweep_scope()
    {
        var cycle = TestCycles.Create(
            Guid.NewGuid(), "FY26", PerformanceCycleType.Annual, Start, Start.AddYears(1),
            objectiveSettingDeadline: Start.AddDays(30));

        // A draft has no frozen baseline, so its workspaces have nothing to show.
        Assert.False(cycle.IsOpenOrClosed());
    }

    [Fact]
    public void A_closed_campaign_is_no_longer_editable()
    {
        var cycle = LaunchedCycle();
        cycle.Close(CampaignClosureKind.Automatic, Actor, "HR Admin", Start.AddMonths(11));

        Assert.False(cycle.IsEditable);
    }

    [Fact]
    public void The_closure_timestamp_is_normalised_to_utc()
    {
        var cycle = LaunchedCycle();
        var local = new DateTime(2026, 11, 30, 12, 0, 0, DateTimeKind.Local);

        cycle.Close(CampaignClosureKind.Manual, Actor, "HR Admin", local);

        Assert.Equal(DateTimeKind.Utc, cycle.ClosedAt!.Value.Kind);
    }

    [Fact]
    public void A_blank_actor_name_is_stored_as_absent_rather_than_as_whitespace()
    {
        var cycle = LaunchedCycle();

        cycle.Close(CampaignClosureKind.Automatic, actorUserId: null, actorName: "   ", Start.AddMonths(11));

        Assert.Null(cycle.ClosedByName);
        Assert.Null(cycle.ClosedByUserId);
    }
}
