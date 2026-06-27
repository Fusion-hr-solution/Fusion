namespace EY.HRPlatform.CoreHR.Domain.ValueObjects;

/// <summary>
/// The single half-open effective-dated interval convention shared by all canonical
/// workforce facts (<c>Employment</c>, <c>WorkAssignment</c>, <c>ManagerRelationship</c>):
/// <c>[EffectiveFrom, EffectiveTo)</c> — inclusive of <see cref="EffectiveFrom"/>, exclusive
/// of <see cref="EffectiveTo"/>, with a null end meaning open-ended (currently in effect).
///
/// Centralizing the convention here removes same-effective-date ambiguity: closing a fact
/// effective <c>D</c> sets its end to <c>D</c> and the successor's start to <c>D</c>, so the
/// as-of query on <c>D</c> returns the successor, and adjacent intervals are contiguous and
/// non-overlapping.
/// </summary>
public readonly record struct EffectiveDateRange
{
    private EffectiveDateRange(DateTime effectiveFrom, DateTime? effectiveTo)
    {
        EffectiveFrom = effectiveFrom;
        EffectiveTo = effectiveTo;
    }

    public DateTime EffectiveFrom { get; }
    public DateTime? EffectiveTo { get; }

    public bool IsOpenEnded => EffectiveTo is null;

    /// <summary>
    /// Creates a normalized, validated half-open interval. Dates must be UTC or local
    /// (local is converted to UTC); an exclusive end must be strictly after the start.
    /// </summary>
    public static EffectiveDateRange Create(DateTime effectiveFrom, DateTime? effectiveTo = null)
    {
        var from = NormalizeUtc(effectiveFrom, nameof(effectiveFrom));
        DateTime? to = effectiveTo.HasValue ? NormalizeUtc(effectiveTo.Value, nameof(effectiveTo)) : null;

        if (to.HasValue && to.Value <= from)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));

        return new EffectiveDateRange(from, to);
    }

    /// <summary>
    /// A fact is active "as of" <paramref name="asOf"/> when
    /// <c>EffectiveFrom &lt;= asOf</c> and (<c>EffectiveTo</c> is null or <c>asOf &lt; EffectiveTo</c>).
    /// </summary>
    public bool IsActiveOn(DateTime asOf)
    {
        var at = NormalizeUtc(asOf, nameof(asOf));
        return EffectiveFrom <= at && (EffectiveTo is null || at < EffectiveTo.Value);
    }

    /// <summary>
    /// Half-open overlap test. Two intervals overlap when each starts strictly before the
    /// other ends. Adjacent intervals (one ends exactly where the next begins) do NOT overlap.
    /// </summary>
    public bool Overlaps(EffectiveDateRange other)
    {
        var thisStartsBeforeOtherEnds = other.EffectiveTo is null || EffectiveFrom < other.EffectiveTo.Value;
        var otherStartsBeforeThisEnds = EffectiveTo is null || other.EffectiveFrom < EffectiveTo.Value;
        return thisStartsBeforeOtherEnds && otherStartsBeforeThisEnds;
    }

    /// <summary>True when this interval ends exactly where <paramref name="successor"/> begins.</summary>
    public bool IsContiguousWith(EffectiveDateRange successor)
        => EffectiveTo.HasValue && EffectiveTo.Value == successor.EffectiveFrom;

    /// <summary>
    /// Close-and-succeed helper: returns this interval closed at <paramref name="effectiveDate"/>
    /// (sets <see cref="EffectiveTo"/> to the change date). The change date must be after the
    /// start and not after an existing end, so the closed interval stays non-empty and valid.
    /// </summary>
    public EffectiveDateRange CloseAt(DateTime effectiveDate)
    {
        var at = NormalizeUtc(effectiveDate, nameof(effectiveDate));

        if (at <= EffectiveFrom)
            throw new ArgumentException("Close date must be after the interval start.", nameof(effectiveDate));

        if (EffectiveTo.HasValue && at > EffectiveTo.Value)
            throw new ArgumentException("Close date cannot be after the existing interval end.", nameof(effectiveDate));

        return new EffectiveDateRange(EffectiveFrom, at);
    }

    internal static DateTime NormalizeUtc(DateTime value, string parameterName)
    {
        if (value == default)
            throw new ArgumentException("A valid effective date is required.", parameterName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => throw new ArgumentException("Effective dates must be UTC or local time.", parameterName)
        };
    }
}
