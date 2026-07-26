using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class CycleDeadlineTests
{
    private static readonly DateTime Now = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void NoDeadline_IsNone()
        => Assert.Equal(CycleDeadline.None, CycleDeadline.Evaluate(null, PerformanceCycleStatus.Launched, Now, 3));

    [Fact]
    public void Draft_IsNone()
        => Assert.Equal(CycleDeadline.None, CycleDeadline.Evaluate(Now.AddDays(1), PerformanceCycleStatus.Draft, Now, 3));

    [Fact]
    public void DeadlineInPast_IsOverdue()
        => Assert.Equal(CycleDeadline.Overdue, CycleDeadline.Evaluate(Now.AddDays(-1), PerformanceCycleStatus.Launched, Now, 3));

    [Fact]
    public void DeadlineWithinWindow_IsDueSoon()
        => Assert.Equal(CycleDeadline.DueSoon, CycleDeadline.Evaluate(Now.AddDays(2), PerformanceCycleStatus.Launched, Now, 3));

    [Fact]
    public void DeadlineBeyondWindow_IsUpcoming()
        => Assert.Equal(CycleDeadline.Upcoming, CycleDeadline.Evaluate(Now.AddDays(10), PerformanceCycleStatus.Launched, Now, 3));
}
