using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class CheckInFollowUpActionTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid CheckInId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();
    private static readonly Guid ReviewerId = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);

    private static CheckInFollowUpAction EmployeeOwned()
        => CheckInFollowUpAction.Create(
            TenantId, CycleId, CheckInId, EmployeeId,
            "Share the updated delivery plan", FollowUpActionOwnerKind.Employee,
            EmployeeId, "Alice Employee", Now.AddDays(7), null, Now);

    private static CheckInFollowUpAction ReviewerOwned()
        => CheckInFollowUpAction.Create(
            TenantId, CycleId, CheckInId, EmployeeId,
            "Arrange mentoring", FollowUpActionOwnerKind.Reviewer,
            ReviewerId, "Mia Manager", Now.AddDays(7), null, Now);

    [Fact]
    public void Create_StartsOpen_WithCreatedEvent()
    {
        var action = EmployeeOwned();

        Assert.Equal(FollowUpActionStatus.Open, action.Status);
        Assert.Equal(EmployeeId, action.OwnerEmployeeId);
        Assert.Contains(action.DomainEvents, e => e is FollowUpActionCreatedEvent);
    }

    [Fact]
    public void Complete_ByOwner_MovesToCompleted_AndAppendsStatusEvent()
    {
        var action = EmployeeOwned();

        action.Complete(EmployeeId, "Alice Employee", "Done", Now.AddDays(2));

        Assert.Equal(FollowUpActionStatus.Completed, action.Status);
        Assert.Equal("Done", action.ResolutionNote);
        Assert.Single(action.StatusEvents);
        Assert.Contains(action.DomainEvents, e => e is FollowUpActionCompletedEvent);
    }

    [Fact]
    public void Complete_ByNonOwner_IsRejected()
    {
        var action = EmployeeOwned();

        Assert.Throws<DomainRuleViolationException>(() =>
            action.Complete(ReviewerId, "Mia Manager", null, Now.AddDays(2)));
    }

    [Fact]
    public void Complete_Twice_IsRejected()
    {
        var action = EmployeeOwned();
        action.Complete(EmployeeId, "Alice Employee", null, Now.AddDays(2));

        Assert.Throws<DomainRuleViolationException>(() =>
            action.Complete(EmployeeId, "Alice Employee", null, Now.AddDays(3)));
    }

    [Fact]
    public void Cancel_ByReviewer_RequiresReason_AndIsTerminal()
    {
        var action = ReviewerOwned();

        Assert.Throws<DomainRuleViolationException>(() =>
            action.Cancel(ReviewerId, "Mia Manager", "  ", Now.AddDays(1)));

        action.Cancel(ReviewerId, "Mia Manager", "Superseded", Now.AddDays(1));

        Assert.Equal(FollowUpActionStatus.Cancelled, action.Status);
        Assert.Equal("Superseded", action.ResolutionNote);
        Assert.Contains(action.DomainEvents, e => e is FollowUpActionCancelledEvent);
    }

    [Fact]
    public void Complete_AfterCancel_IsRejected()
    {
        var action = ReviewerOwned();
        action.Cancel(ReviewerId, "Mia Manager", "Superseded", Now.AddDays(1));

        Assert.Throws<DomainRuleViolationException>(() =>
            action.Complete(ReviewerId, "Mia Manager", null, Now.AddDays(2)));
    }
}
