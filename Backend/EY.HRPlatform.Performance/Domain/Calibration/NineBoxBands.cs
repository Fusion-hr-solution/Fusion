namespace EY.HRPlatform.Performance.Domain.Calibration;

/// <summary>
/// The nine-box performance axis (D-24): the rating scale split into a low, middle and top band by two
/// cut points, the highest value of the low band and of the middle band. Every band holds at least one level.
/// </summary>
public readonly record struct NineBoxBands(int LowTop, int MidTop)
{
    /// <summary>
    /// The low band takes ⌊(n+1)/3⌋ levels, the middle ⌊n/3⌋ and the top the rest:
    /// 1–2 · 3 · 4–5 for five levels, 1 · 2 · 3 for three.
    /// </summary>
    public static NineBoxBands Default(IReadOnlyList<int> scale)
    {
        var values = Ordered(scale);
        var low = (values.Length + 1) / 3;
        var middle = values.Length / 3;
        return new NineBoxBands(values[low - 1], values[low + middle - 1]);
    }

    /// <summary>The tenant's chosen bands, or the default when none were set.</summary>
    public static NineBoxBands Resolve(int? lowTop, int? midTop, IReadOnlyList<int> scale)
    {
        if (lowTop is not int low || midTop is not int middle) return Default(scale);
        Validate(low, middle, scale);
        return new NineBoxBands(low, middle);
    }

    public static void Validate(int lowTop, int midTop, IReadOnlyList<int> scale)
    {
        var values = Ordered(scale);
        if (!values.Contains(lowTop) || !values.Contains(midTop) || lowTop >= midTop || midTop >= values[^1])
            throw new ArgumentException("Each nine-box band needs at least one level of the rating scale.", nameof(lowTop));
    }

    /// <summary>0 for the low band, 1 for the middle, 2 for the top.</summary>
    public int BandOf(int rating) => rating <= LowTop ? 0 : rating <= MidTop ? 1 : 2;

    private static int[] Ordered(IReadOnlyList<int> scale)
    {
        var values = scale.Distinct().Order().ToArray();
        if (values.Length < 3) throw new ArgumentException("A nine-box needs a scale of at least three levels.", nameof(scale));
        return values;
    }
}
