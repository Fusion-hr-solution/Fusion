using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class ObjectiveDiscussionSignalTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid PlanId = Guid.NewGuid();
    private static readonly Guid ObjectiveId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();
    private static readonly Guid ReviewerId = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);

    private static ObjectiveDiscussionSignal Raise(string? note = "I'm blocked on this")
        => ObjectiveDiscussionSignal.Raise(
            TenantId, CycleId, PlanId, ObjectiveId, EmployeeId,
            "Delivery quality", "Alice Employee", note, Now);

    [Fact]
    public void Raise_StartsOpen_WithRaisedEvent()
    {
        var signal = Raise();

        Assert.Equal(DiscussionSignalStatus.Open, signal.Status);
        Assert.Equal("I'm blocked on this", signal.Note);
        Assert.Contains(signal.DomainEvents, e => e is DiscussionSignalRaisedEvent);
    }

    [Fact]
    public void ResolveByCheckIn_ResolvesAndStampsCheckIn()
    {
        var signal = Raise();
        var checkInId = Guid.NewGuid();
        signal.LinkToCheckIn(checkInId);

        signal.ResolveByCheckIn(checkInId, Now.AddDays(3));

        Assert.Equal(DiscussionSignalStatus.ResolvedByCheckIn, signal.Status);
        Assert.Equal(checkInId, signal.ResolvedByCheckInId);
        Assert.Contains(signal.DomainEvents, e => e is DiscussionSignalResolvedEvent);
    }

    [Fact]
    public void ReturnToOpen_ClearsLink_WhenCheckInCancelled()
    {
        var signal = Raise();
        var checkInId = Guid.NewGuid();
        signal.LinkToCheckIn(checkInId);

        signal.ReturnToOpen();

        Assert.Equal(DiscussionSignalStatus.Open, signal.Status);
        Assert.Null(signal.LinkedCheckInId);
    }

    [Fact]
    public void ReturnToOpen_DoesNotReviveResolvedSignal()
    {
        var signal = Raise();
        var checkInId = Guid.NewGuid();
        signal.LinkToCheckIn(checkInId);
        signal.ResolveByCheckIn(checkInId, Now.AddDays(3));

        signal.ReturnToOpen();

        Assert.Equal(DiscussionSignalStatus.ResolvedByCheckIn, signal.Status);
    }

    [Fact]
    public void Close_ByReviewer_RequiresReason_AndIsTerminal()
    {
        var signal = Raise();

        Assert.Throws<DomainRuleViolationException>(() => signal.Close(ReviewerId, "  ", Now.AddDays(1)));

        signal.Close(ReviewerId, "Resolved offline", Now.AddDays(1));

        Assert.Equal(DiscussionSignalStatus.Closed, signal.Status);
        Assert.Equal("Resolved offline", signal.CloseReason);
        Assert.Contains(signal.DomainEvents, e => e is DiscussionSignalClosedEvent);
    }

    [Fact]
    public void LinkToCheckIn_AfterClose_IsRejected()
    {
        var signal = Raise();
        signal.Close(ReviewerId, "Resolved offline", Now.AddDays(1));

        Assert.Throws<DomainRuleViolationException>(() => signal.LinkToCheckIn(Guid.NewGuid()));
    }
}
