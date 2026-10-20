namespace EY.HRPlatform.Performance.Domain.Calibration;

/// <summary>One calibration subject as the insights see it. Attainment is a percentage; null when nothing is weighted.</summary>
public sealed record InsightSubject(Guid ReviewId, Guid ReviewerId, string ReviewerName, int OriginalRating, int CurrentRating,
    decimal? Attainment, InsightLastResult? Last);

/// <summary>The person's most recent released result in an earlier cycle, with the size of the scale it used.</summary>
public sealed record InsightLastResult(int Rating, int ScaleLevels, string CycleName);

public sealed record ManagerInsight(Guid ReviewerId, string ReviewerName, int Reviews, decimal OriginalAverage, decimal CurrentAverage,
    decimal Delta, bool Lenient);

public sealed record PersonInsight(Guid ReviewId, bool DisagreesWithObjectives, int? MovedSinceLast)
{
    /// <summary>A move of two or more levels since the last released result.</summary>
    public bool Moved => MovedSinceLast is int moved && Math.Abs(moved) >= CalibrationInsights.MoveLevels;
    public bool Flagged => DisagreesWithObjectives || Moved;
}

public sealed record CalibrationInsightSet(decimal SessionAverage, IReadOnlyList<ManagerInsight> Managers,
    IReadOnlyDictionary<Guid, PersonInsight> People)
{
    public int Flags => Managers.Count(manager => manager.Lenient) + People.Values.Count(person => person.Flagged);
}

/// <summary>
/// Calibration insights (D-25): computed from recorded data on each read, never by AI, never stored and never
/// blocking. Leniency compares the ratings managers gave, so it stays while the session corrects it; the person
/// flags follow the current rating.
/// </summary>
public static class CalibrationInsights
{
    public const decimal LeniencyDistance = 0.75m;
    public const int LeniencyMinimumReviews = 3;
    public const decimal TopBandAttainmentBelow = 50m;
    public const decimal BottomBandAttainmentFrom = 90m;
    public const int MoveLevels = 2;

    public static CalibrationInsightSet Compute(IReadOnlyList<InsightSubject> subjects, NineBoxBands bands, int scaleLevels)
    {
        if (subjects.Count == 0) return new(0m, [], new Dictionary<Guid, PersonInsight>());
        var sessionAverage = subjects.Average(subject => (decimal)subject.OriginalRating);
        var managers = subjects.GroupBy(subject => subject.ReviewerId)
            .Select(team =>
            {
                var original = team.Average(subject => (decimal)subject.OriginalRating);
                var delta = original - sessionAverage;
                return new ManagerInsight(team.Key, team.First().ReviewerName, team.Count(), original,
                    team.Average(subject => (decimal)subject.CurrentRating), delta,
                    team.Count() >= LeniencyMinimumReviews && Math.Abs(delta) >= LeniencyDistance);
            })
            .OrderByDescending(manager => Math.Abs(manager.Delta)).ThenBy(manager => manager.ReviewerName, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var people = subjects.ToDictionary(subject => subject.ReviewId, subject => new PersonInsight(subject.ReviewId,
            Disagrees(subject, bands),
            subject.Last is { } last && last.ScaleLevels == scaleLevels ? subject.CurrentRating - last.Rating : null));
        return new(sessionAverage, managers, people);
    }

    private static bool Disagrees(InsightSubject subject, NineBoxBands bands)
        => subject.Attainment is decimal attainment && bands.BandOf(subject.CurrentRating) switch
        {
            2 => attainment < TopBandAttainmentBelow,
            0 => attainment >= BottomBandAttainmentFrom,
            _ => false,
        };

    /// <summary>Weight-averaged progress, each objective capped at 100%. Null when no objective carries weight.</summary>
    public static decimal? Attainment(IEnumerable<(decimal Weight, decimal Progress)> objectives)
    {
        var weighted = objectives.Where(item => item.Weight > 0).ToArray();
        var total = weighted.Sum(item => item.Weight);
        if (total <= 0) return null;
        return weighted.Sum(item => item.Weight * Math.Clamp(item.Progress, 0m, 100m)) / total;
    }
}
