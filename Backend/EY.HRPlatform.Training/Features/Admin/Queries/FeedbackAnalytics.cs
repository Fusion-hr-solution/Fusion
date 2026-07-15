using System.Globalization;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>Shared maths + policy for the feedback analytics queries (US-8.1.2).</summary>
internal static class FeedbackAnalytics
{
    /// <summary>
    /// The feedback feature launch instant. Completions before this had no opportunity to give
    /// feedback, so they are excluded from the Response Rate denominator (see CONTEXT: Response Rate).
    /// </summary>
    public static readonly DateTime LaunchedAtUtc = new(2026, 6, 25, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>Comments are hidden for a training with fewer than this many responses (anonymity).</summary>
    public const int CommentSuppressionThreshold = 3;

    public static double AvgRating(IEnumerable<int> ratings)
    {
        var list = ratings as IReadOnlyList<int> ?? ratings.ToList();
        return list.Count > 0 ? Math.Round(list.Average(), 2) : 0;
    }

    public static double Rate(int numerator, int denominator) =>
        denominator > 0 ? Math.Round((double)numerator / denominator * 100, 1) : 0;

    /// <summary>Overall-rating histogram: index 0 = 1★ … index 4 = 5★.</summary>
    public static int[] Distribution(IEnumerable<int> overallRatings)
    {
        var counts = new int[5];
        foreach (var r in overallRatings)
            if (r is >= 1 and <= 5)
                counts[r - 1]++;
        return counts;
    }

    public static List<FeedbackTrendPointDto> MonthlyTrend(IEnumerable<(DateTime When, int Overall)> items) =>
        items
            .GroupBy(i => new { i.When.Year, i.When.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new FeedbackTrendPointDto
            {
                Year = g.Key.Year,
                Month = g.Key.Month,
                Label = new DateTime(g.Key.Year, g.Key.Month, 1)
                    .ToString("MMM yyyy", CultureInfo.InvariantCulture),
                AvgOverallRating = AvgRating(g.Select(x => x.Overall)),
                ResponseCount = g.Count(),
            })
            .ToList();

    /// <summary>Trainer aggregation key: internal employee id, else normalised email, else name.</summary>
    public static string TrainerKey(Guid? trainerEmployeeId, string? trainerEmail, string? trainerName)
    {
        if (trainerEmployeeId.HasValue)
            return trainerEmployeeId.Value.ToString();
        if (!string.IsNullOrWhiteSpace(trainerEmail))
            return trainerEmail.Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(trainerName) ? "unknown" : trainerName.Trim().ToLowerInvariant();
    }
}
