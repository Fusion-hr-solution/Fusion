using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceCheckInTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid CycleId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();
    private static readonly Guid ReviewerId = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc);

    private static PerformanceCheckIn Plan(DateTime? plannedDate = null)
        => PerformanceCheckIn.Plan(
            TenantId,
            CycleId,
            EmployeeId,
            ReviewerId,
            "Mia Manager",
            "Default approver",
            plannedDate ?? Now.AddDays(3),
            "10:30",
            "Mid-cycle progress",
            "Review delivery objective",
            Now);

    [Fact]
    public void Plan_CreatesPlannedCheckIn_WithReviewerSnapshotAndEvent()
    {
        var checkIn = Plan();

        Assert.Equal(CheckInStatus.Planned, checkIn.Status);
        Assert.Equal(ReviewerId, checkIn.CreatedByReviewerId);
        Assert.Equal("Mia Manager", checkIn.CreatedByReviewerName);
        Assert.Equal("Default approver", checkIn.ReviewerRelationship);
        Assert.Contains(checkIn.DomainEvents, e => e is CheckInPlannedEvent);
    }

    [Fact]
    public void Plan_RequiresReason()
    {
        Assert.Throws<DomainRuleViolationException>(() => PerformanceCheckIn.Plan(
            TenantId, CycleId, EmployeeId, ReviewerId, "Mia Manager", "Default approver",
            Now.AddDays(3), null, "   ", null, Now));
    }

    [Fact]
    public void AddLinkedObjective_IsIdempotent()
    {
        var checkIn = Plan();
        var objectiveId = Guid.NewGuid();

        checkIn.AddLinkedObjective(objectiveId, "Delivery quality");
        checkIn.AddLinkedObjective(objectiveId, "Delivery quality");

        Assert.Single(checkIn.LinkedObjectives);
    }

    [Fact]
    public void Reschedule_RecordsHistoryAndUpdatesDate()
    {
        var checkIn = Plan();
        var newDate = Now.AddDays(5);

        checkIn.Reschedule(newDate, "14:00", ReviewerId, "Mia Manager", Now.AddHours(1));

        Assert.Equal(newDate, checkIn.PlannedDate);
        Assert.Equal("14:00", checkIn.PlannedTime);
        Assert.Single(checkIn.RescheduleHistory);
        Assert.Contains(checkIn.DomainEvents, e => e is CheckInRescheduledEvent);
    }

    [Fact]
    public void Cancel_MakesRecordTerminal_AndBlocksFurtherReschedule()
    {
        var checkIn = Plan();

        checkIn.Cancel("No longer needed", ReviewerId, "Mia Manager", Now.AddHours(1));

        Assert.Equal(CheckInStatus.Cancelled, checkIn.Status);
        Assert.Equal("No longer needed", checkIn.CancellationReason);
        Assert.Contains(checkIn.DomainEvents, e => e is CheckInCancelledEvent);
        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.Reschedule(Now.AddDays(6), null, ReviewerId, "Mia Manager", Now.AddHours(2)));
    }

    [Fact]
    public void Complete_MarksDiscussedObjectives_AndSetsSummary()
    {
        var checkIn = Plan();
        var objectiveId = Guid.NewGuid();

        checkIn.Complete(
            "We discussed delivery and agreed next steps.",
            [new CheckInDiscussedObjective(objectiveId, "Delivery quality")],
            ReviewerId,
            "Mia Manager",
            Now.AddDays(3));

        Assert.Equal(CheckInStatus.Completed, checkIn.Status);
        Assert.Equal("We discussed delivery and agreed next steps.", checkIn.CompletionSummary);
        var linked = Assert.Single(checkIn.LinkedObjectives);
        Assert.True(linked.WasDiscussed);
        Assert.Contains(checkIn.DomainEvents, e => e is CheckInCompletedEvent);
    }

    [Fact]
    public void Complete_RequiresSummary()
    {
        var checkIn = Plan();

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.Complete("  ", [], ReviewerId, "Mia Manager", Now.AddDays(3)));
    }

    [Fact]
    public void Complete_Twice_IsRejected()
    {
        var checkIn = Plan();
        checkIn.Complete("Summary", [], ReviewerId, "Mia Manager", Now.AddDays(3));

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.Complete("Again", [], ReviewerId, "Mia Manager", Now.AddDays(3)));
    }

    [Fact]
    public void Cancel_AfterComplete_IsRejected()
    {
        var checkIn = Plan();
        checkIn.Complete("Summary", [], ReviewerId, "Mia Manager", Now.AddDays(3));

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.Cancel("Too late", ReviewerId, "Mia Manager", Now.AddDays(3)));
    }

    [Fact]
    public void AddAddendum_OnlyAfterCompleted()
    {
        var checkIn = Plan();

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.AddAddendum(ReviewerId, "Mia Manager", "Correction", Now.AddDays(4)));

        checkIn.Complete("Summary", [], ReviewerId, "Mia Manager", Now.AddDays(3));
        checkIn.AddAddendum(ReviewerId, "Mia Manager", "One clarification.", Now.AddDays(4));

        Assert.Single(checkIn.Addenda);
        Assert.Contains(checkIn.DomainEvents, e => e is CheckInAddendumAddedEvent);
    }

    [Fact]
    public void AddEmployeeResponse_IsSingleAndImmutable()
    {
        var checkIn = Plan();
        checkIn.Complete("Summary", [], ReviewerId, "Mia Manager", Now.AddDays(3));

        checkIn.AddEmployeeResponse(EmployeeId, "Alice Employee", "Thanks, agreed.", Now.AddDays(4));

        Assert.NotNull(checkIn.Response);
        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.AddEmployeeResponse(EmployeeId, "Alice Employee", "Second thought.", Now.AddDays(5)));
    }

    [Fact]
    public void AddEmployeeResponse_RejectsNonParticipant()
    {
        var checkIn = Plan();
        checkIn.Complete("Summary", [], ReviewerId, "Mia Manager", Now.AddDays(3));

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.AddEmployeeResponse(Guid.NewGuid(), "Someone Else", "Not mine.", Now.AddDays(4)));
    }

    [Fact]
    public void AddEmployeeResponse_BeforeCompleted_IsRejected()
    {
        var checkIn = Plan();

        Assert.Throws<DomainRuleViolationException>(() =>
            checkIn.AddEmployeeResponse(EmployeeId, "Alice Employee", "Too early.", Now.AddDays(1)));
    }
}
