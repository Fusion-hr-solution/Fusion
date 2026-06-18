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
        => PerformanceCycle.Create(TenantId, "FY26 Review", PerformanceCycleType.Annual, Start, End, deadline);

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
        cycle.Publish(1);

        Assert.Throws<DomainRuleViolationException>(() =>
            cycle.UpdateDetails("New name", PerformanceCycleType.Annual, Start, End, null, false, null));
    }

    [Fact]
    public void SetPopulation_WhenNotDraft_Throws()
    {
        var cycle = NewDraft();
        cycle.Publish(1);

        Assert.Throws<DomainRuleViolationException>(() => cycle.SetPopulation(false, []));
    }

    [Fact]
    public void Publish_WithNoResolvedPopulation_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(() => cycle.Publish(0));
    }

    [Fact]
    public void Publish_WithPopulation_MovesToPublished()
    {
        var cycle = NewDraft();
        cycle.Publish(3);

        Assert.Equal(PerformanceCycleStatus.Published, cycle.Status);
        Assert.NotNull(cycle.PublishedAt);
        Assert.False(cycle.IsEditable);
    }

    [Fact]
    public void Activate_FromDraft_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(cycle.Activate);
    }

    [Fact]
    public void Activate_FromPublished_Works()
    {
        var cycle = NewDraft();
        cycle.Publish(1);
        cycle.Activate();

        Assert.Equal(PerformanceCycleStatus.Active, cycle.Status);
        Assert.NotNull(cycle.ActivatedAt);
    }

    [Fact]
    public void Close_FromActive_Works()
    {
        var cycle = NewDraft();
        cycle.Publish(1);
        cycle.Activate();
        cycle.Close();

        Assert.Equal(PerformanceCycleStatus.Closed, cycle.Status);
        Assert.NotNull(cycle.ClosedAt);
    }

    [Fact]
    public void Close_FromDraft_Throws()
    {
        var cycle = NewDraft();
        Assert.Throws<DomainRuleViolationException>(cycle.Close);
    }
}
