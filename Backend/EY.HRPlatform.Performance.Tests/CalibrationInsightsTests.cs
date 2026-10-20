using EY.HRPlatform.Performance.Domain.Calibration;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>D-25 thresholds at their edges: leniency, rating against objectives, and moves since the last cycle.</summary>
public sealed class CalibrationInsightsTests
{
    private static readonly NineBoxBands Bands = new(2, 3);
    private static readonly Guid Omar = Guid.NewGuid();
    private static readonly Guid Others = Guid.NewGuid();

    private static InsightSubject Person(Guid reviewer, int original, int? current = null, decimal? attainment = null, InsightLastResult? last = null)
        => new(Guid.NewGuid(), reviewer, reviewer == Omar ? "Omar Mansour" : "Others", original, current ?? original, attainment, last);

    [Fact]
    public void A_manager_three_quarters_of_a_level_from_the_session_is_lenient()
    {
        // Omar 4,4,4 (avg 4); others 3,3,3,3,3,3,3,3,3 (session avg 3.25): delta 0.75 → flagged.
        var subjects = new[] { Person(Omar, 4), Person(Omar, 4), Person(Omar, 4) }
            .Concat(Enumerable.Range(0, 9).Select(_ => Person(Others, 3))).ToArray();
        var set = CalibrationInsights.Compute(subjects, Bands, 5);
        var omar = set.Managers.Single(manager => manager.ReviewerId == Omar);
        Assert.Equal(0.75m, omar.Delta);
        Assert.True(omar.Lenient);
        Assert.Equal(Omar, set.Managers[0].ReviewerId);
    }

    [Fact]
    public void Just_under_three_quarters_is_not_lenient()
    {
        // Omar 4,4,4,4 (avg 4); others ten at 3 and one at 4 (session avg 52/15 = 3.4667): delta 0.533.
        var subjects = new[] { Person(Omar, 4), Person(Omar, 4), Person(Omar, 4), Person(Omar, 4), Person(Others, 4) }
            .Concat(Enumerable.Range(0, 10).Select(_ => Person(Others, 3))).ToArray();
        var omar = CalibrationInsights.Compute(subjects, Bands, 5).Managers.Single(manager => manager.ReviewerId == Omar);
        Assert.True(omar.Delta < 0.75m);
        Assert.False(omar.Lenient);

        // 0.74: Omar 4,4,4 against 37 at 3 and 10 at 4 (session avg 163/50 = 3.26).
        var near = CalibrationInsights.Compute(
            [Person(Omar, 4), Person(Omar, 4), Person(Omar, 4), .. Enumerable.Range(0, 37).Select(_ => Person(Others, 3)),
                .. Enumerable.Range(0, 10).Select(_ => Person(Others, 4))],
            Bands, 5).Managers.Single(manager => manager.ReviewerId == Omar);
        Assert.Equal(0.74m, near.Delta);
        Assert.False(near.Lenient);
    }

    [Fact]
    public void Two_reviews_are_never_enough_for_leniency()
    {
        var set = CalibrationInsights.Compute([Person(Omar, 5), Person(Omar, 5), .. Enumerable.Range(0, 6).Select(_ => Person(Others, 3))], Bands, 5);
        Assert.False(set.Managers.Single(manager => manager.ReviewerId == Omar).Lenient);
    }

    [Fact]
    public void Leniency_compares_the_managers_original_ratings()
    {
        var subjects = new[] { Person(Omar, 5, current: 3), Person(Omar, 5, current: 3), Person(Omar, 5, current: 3) }
            .Concat(Enumerable.Range(0, 6).Select(_ => Person(Others, 3))).ToArray();
        var omar = CalibrationInsights.Compute(subjects, Bands, 5).Managers.Single(manager => manager.ReviewerId == Omar);
        Assert.Equal((5m, 3m), (omar.OriginalAverage, omar.CurrentAverage));
        Assert.True(omar.Lenient);
    }

    [Theory]
    [InlineData(5, 49.9, true)]
    [InlineData(5, 50, false)]
    [InlineData(4, 10, true)]
    [InlineData(3, 10, false)]
    [InlineData(2, 90, true)]
    [InlineData(1, 89.9, false)]
    [InlineData(3, 95, false)]
    public void Rating_against_objectives_uses_the_band_and_the_attainment_edges(int rating, double attainment, bool flagged)
    {
        var person = Person(Others, rating, attainment: (decimal)attainment);
        Assert.Equal(flagged, CalibrationInsights.Compute([person], Bands, 5).People[person.ReviewId].DisagreesWithObjectives);
    }

    [Fact]
    public void Without_weighted_objectives_the_disagreement_flag_is_not_computed()
    {
        var person = Person(Others, 5);
        Assert.False(CalibrationInsights.Compute([person], Bands, 5).People[person.ReviewId].DisagreesWithObjectives);
        Assert.Null(CalibrationInsights.Attainment([(0m, 40m)]));
        Assert.Equal(72m, CalibrationInsights.Attainment([(60m, 120m), (40m, 30m)]));
    }

    [Theory]
    [InlineData(4, 2, 5, true, -2)]
    [InlineData(4, 3, 5, false, -1)]
    [InlineData(2, 5, 5, true, 3)]
    public void Moves_of_two_levels_since_the_last_released_result_are_flagged(int last, int now, int levels, bool flagged, int moved)
    {
        var person = Person(Others, now, last: new InsightLastResult(last, levels, "FY26"));
        var insight = CalibrationInsights.Compute([person], Bands, 5).People[person.ReviewId];
        Assert.Equal((flagged, (int?)moved), (insight.Moved, insight.MovedSinceLast));
    }

    [Fact]
    public void No_history_or_a_different_scale_computes_no_move()
    {
        var first = Person(Others, 2);
        var otherScale = Person(Others, 2, last: new InsightLastResult(4, 4, "FY26"));
        var set = CalibrationInsights.Compute([first, otherScale], Bands, 5);
        Assert.Null(set.People[first.ReviewId].MovedSinceLast);
        Assert.Null(set.People[otherScale.ReviewId].MovedSinceLast);
        Assert.Equal(0, set.Flags);
    }
}
