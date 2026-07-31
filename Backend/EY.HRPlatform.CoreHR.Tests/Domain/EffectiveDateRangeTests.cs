using EY.HRPlatform.CoreHR.Domain.ValueObjects;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class EffectiveDateRangeTests
{
    private static DateTime Utc(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_RejectsEndOnOrBeforeStart()
    {
        var from = Utc(2026, 1, 10);

        Assert.Throws<ArgumentException>(() => EffectiveDateRange.Create(from, from));
        Assert.Throws<ArgumentException>(() => EffectiveDateRange.Create(from, Utc(2026, 1, 9)));
    }

    [Fact]
    public void Create_RejectsUnspecifiedKind()
    {
        var unspecified = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);
        Assert.Throws<ArgumentException>(() => EffectiveDateRange.Create(unspecified));
    }

    [Fact]
    public void IsActiveOn_UsesHalfOpenBoundaries()
    {
        var range = EffectiveDateRange.Create(Utc(2026, 1, 10), Utc(2026, 1, 20));

        Assert.False(range.IsActiveOn(Utc(2026, 1, 9)));   // before start
        Assert.True(range.IsActiveOn(Utc(2026, 1, 10)));   // inclusive start
        Assert.True(range.IsActiveOn(Utc(2026, 1, 19)));   // within
        Assert.False(range.IsActiveOn(Utc(2026, 1, 20)));  // exclusive end
        Assert.False(range.IsActiveOn(Utc(2026, 1, 21)));  // after end
    }

    [Fact]
    public void IsActiveOn_OpenEndedHasNoUpperBound()
    {
        var range = EffectiveDateRange.Create(Utc(2026, 1, 10));

        Assert.True(range.IsOpenEnded);
        Assert.True(range.IsActiveOn(Utc(2026, 1, 10)));
        Assert.True(range.IsActiveOn(Utc(2099, 1, 1)));
        Assert.False(range.IsActiveOn(Utc(2026, 1, 9)));
    }

    [Fact]
    public void Overlaps_AdjacentIntervalsDoNotOverlap()
    {
        var first = EffectiveDateRange.Create(Utc(2026, 1, 10), Utc(2026, 1, 20));
        var second = EffectiveDateRange.Create(Utc(2026, 1, 20), Utc(2026, 1, 30));

        Assert.False(first.Overlaps(second));
        Assert.False(second.Overlaps(first));
        Assert.True(first.IsContiguousWith(second));
    }

    [Fact]
    public void Overlaps_TrueWhenIntervalsShareInterior()
    {
        var first = EffectiveDateRange.Create(Utc(2026, 1, 10), Utc(2026, 1, 25));
        var second = EffectiveDateRange.Create(Utc(2026, 1, 20), Utc(2026, 1, 30));

        Assert.True(first.Overlaps(second));
        Assert.True(second.Overlaps(first));
    }

    [Fact]
    public void Overlaps_TwoOpenEndedRangesAlwaysOverlap()
    {
        var first = EffectiveDateRange.Create(Utc(2026, 1, 10));
        var second = EffectiveDateRange.Create(Utc(2026, 6, 1));

        Assert.True(first.Overlaps(second));
        Assert.True(second.Overlaps(first));
    }

    [Fact]
    public void CloseAt_ProducesContiguousNonOverlappingSuccessor()
    {
        var original = EffectiveDateRange.Create(Utc(2026, 1, 10));
        var changeDate = Utc(2026, 3, 1);

        var closed = original.CloseAt(changeDate);
        var successor = EffectiveDateRange.Create(changeDate);

        Assert.Equal(changeDate, closed.EffectiveTo);
        Assert.False(closed.Overlaps(successor));
        Assert.True(closed.IsContiguousWith(successor));

        // As-of the change date returns the successor, not the closed interval.
        Assert.False(closed.IsActiveOn(changeDate));
        Assert.True(successor.IsActiveOn(changeDate));
    }

    [Fact]
    public void CloseAt_RejectsDateOnOrBeforeStart()
    {
        var range = EffectiveDateRange.Create(Utc(2026, 1, 10));

        Assert.Throws<ArgumentException>(() => range.CloseAt(Utc(2026, 1, 10)));
        Assert.Throws<ArgumentException>(() => range.CloseAt(Utc(2026, 1, 9)));
    }

    [Fact]
    public void CloseAt_RejectsDateAfterExistingEnd()
    {
        var range = EffectiveDateRange.Create(Utc(2026, 1, 10), Utc(2026, 1, 20));

        Assert.Throws<ArgumentException>(() => range.CloseAt(Utc(2026, 1, 25)));
    }
}
