namespace EY.HRPlatform.Training.Features.Admin.Budget;

public static class BudgetThresholds
{
    public static readonly int[] Levels = { 80, 90, 100 };

    /// <summary>
    /// The highest 80/90/100 line newly crossed by a spend change (before &lt; t and after &gt;= t),
    /// or null if none was newly crossed. Levels are ascending, so the last match is the highest.
    /// </summary>
    public static int? HighestNewlyCrossed(decimal beforePercent, decimal afterPercent)
    {
        int? crossed = null;
        foreach (var t in Levels)
            if (beforePercent < t && afterPercent >= t)
                crossed = t;
        return crossed;
    }
}
