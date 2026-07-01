using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCycleTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static PerformanceCycle NewDraft(DateTime? deadline = null)
    {
        var cycle = PerformanceCycle.Create(TenantId, "FY26 Review", PerformanceCycleType.Annual, Start, End, deadline);
        cycle.ConfigureGovernance(Guid.NewGuid(), requireTeamObjectiveSuperiorApproval: false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        return cycle;
    }

    private static void PrepareForLaunch(PerformanceCycle cycle, DateTime occurredAt)
    {
        cycle.BeginAssignmentPreparation(1, occurredAt);
        cycle.MarkReadyToLaunch(1, 0, hasAcceptedWorkforceDelta: true, occurredAt);
    }

    private static void ConfigureForAssignmentPreparation(PerformanceCycle cycle)
        => cycle.ConfigureGovernance(Guid.NewGuid(), requireTeamObjectiveSuperiorApproval: false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);

    [Fact]
    public void Create_WithValidData_StartsAsDraft()
    {
        var cycle = NewDraft();

        Assert.Equal(PerformanceCycleStatus.Draft, cycle.Status);
        Assert.True(cycle.IsEditable);
        Assert.Equal(TenantId, cycle.TenantId);
    }

    [Fact]
    public void Create_WithEndBeforePeriodStart_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            PerformanceCycle.Create(TenantId, "Bad", PerformanceCycleType.Annual, End, Start));
    }

    [Fact]
    public void Create_WithDeadlineOutsidePeriod_Throws()
    {
        Assert.Throws<ArgumentException>(() => NewDraft(End.AddDays(5)));
    }

    [Fact]
    public void UpdateDetails_WhenNotDraft_Throws()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(1, Start);

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.UpdateDetails("New name", PerformanceCycleType.Annual, Start, End, null, false, null));
    }

    [Fact]
    public void SetPopulation_WhenNotDraft_Throws()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(1, Start);

        Assert.Throws<DomainRuleViolationException>(() => cycle.SetPopulation(false, []));
    }

    [Fact]
    public void BeginAssignmentPreparation_WithNoCandidates_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(() => cycle.BeginAssignmentPreparation(0, Start));
    }

    [Fact]
    public void BeginAssignmentPreparation_WithoutGovernanceConfiguration_Throws()
    {
        var cycle = PerformanceCycle.Create(TenantId, "Unconfigured", PerformanceCycleType.Annual, Start, End);

        Assert.Throws<DomainRuleViolationException>(() => cycle.BeginAssignmentPreparation(1, Start));
    }

    [Fact]
    public void BeginAssignmentPreparation_WithPopulation_MovesToAssignmentPreparation()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(3, Start);

        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation, cycle.Status);
        Assert.NotNull(cycle.AssignmentPreparationStartedAt);
        Assert.False(cycle.IsEditable);
    }

    [Fact]
    public void BeginAssignmentPreparation_WithCandidates_MovesToAssignmentPreparation()
    {
        var cycle = NewDraft();

        cycle.BeginAssignmentPreparation(3, Start);

        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation, cycle.Status);
        Assert.NotNull(cycle.AssignmentPreparationStartedAt);
        Assert.False(cycle.IsEditable);
    }

    [Fact]
    public void MarkReadyToLaunch_RequiresFinalResponsibilities()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(1, Start);

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.MarkReadyToLaunch(finalResponsibilityCount: 0, readinessFailureCount: 0, hasAcceptedWorkforceDelta: true, Start));
    }

    [Fact]
    public void MarkReadyToLaunch_WithoutAcceptedWorkforceDelta_Throws()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(1, Start);

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.MarkReadyToLaunch(finalResponsibilityCount: 1, readinessFailureCount: 0, hasAcceptedWorkforceDelta: false, Start));
    }

    [Fact]
    public void Activate_FromReadyToLaunch_MarksActivationTime()
    {
        var cycle = NewDraft();
        cycle.BeginAssignmentPreparation(1, Start);
        cycle.MarkReadyToLaunch(finalResponsibilityCount: 1, readinessFailureCount: 0, hasAcceptedWorkforceDelta: true, Start);

        cycle.Activate(Start);

        Assert.Equal(PerformanceCycleStatus.Active, cycle.Status);
    }

    [Fact]
    public void Activate_FromDraft_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(() => cycle.Activate(Start));
    }

    [Fact]
    public void Activate_FromReadyToLaunch_Works()
    {
        var cycle = NewDraft();
        PrepareForLaunch(cycle, Start);
        cycle.Activate(Start);

        Assert.Equal(PerformanceCycleStatus.Active, cycle.Status);
        Assert.NotNull(cycle.ActivatedAt);
    }

    [Fact]
    public void Close_FromActive_Works()
    {
        var cycle = NewDraft();
        PrepareForLaunch(cycle, Start);
        cycle.Activate(Start);
        cycle.Close(End);

        Assert.Equal(PerformanceCycleStatus.Closed, cycle.Status);
        Assert.NotNull(cycle.ClosedAt);
    }

    [Fact]
    public void Close_FromDraft_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(() => cycle.Close(Start));
    }

    [Fact]
    public void Publish_AfterObjectiveDeadline_Throws()
    {
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "Expired planning window",
            PerformanceCycleType.Annual,
            now.AddDays(-10),
            now.AddDays(10),
            now.AddDays(-1));
        ConfigureForAssignmentPreparation(cycle);

        Assert.Throws<DomainRuleViolationException>(() => cycle.BeginAssignmentPreparation(1, now));
    }

    [Fact]
    public void Activate_BeforePeriodStart_Throws()
    {
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "Future cycle",
            PerformanceCycleType.Annual,
            now.AddDays(1),
            now.AddDays(10));
        ConfigureForAssignmentPreparation(cycle);

        cycle.BeginAssignmentPreparation(1, now);

        cycle.MarkReadyToLaunch(1, 0, hasAcceptedWorkforceDelta: true, now);

        Assert.Throws<DomainRuleViolationException>(() => cycle.Activate(now));
    }

    [Fact]
    public void MarkReadyToLaunch_WithReadinessFailures_Throws()
    {
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "Ready-to-open cycle",
            PerformanceCycleType.Annual,
            now.AddDays(-1),
            now.AddDays(10));
        ConfigureForAssignmentPreparation(cycle);

        cycle.BeginAssignmentPreparation(1, now);

        Assert.Throws<DomainRuleViolationException>(() => cycle.MarkReadyToLaunch(1, 1, hasAcceptedWorkforceDelta: true, now));
    }

    [Fact]
    public void Close_BeforePeriodEnd_Throws()
    {
        var now = new DateTime(2026, 6, 20, 12, 0, 0, DateTimeKind.Utc);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "Open cycle",
            PerformanceCycleType.Annual,
            now.AddDays(-1),
            now.AddDays(10));
        ConfigureForAssignmentPreparation(cycle);

        PrepareForLaunch(cycle, now);
        cycle.Activate(now);

        Assert.Throws<DomainRuleViolationException>(() => cycle.Close(now));
    }
}
