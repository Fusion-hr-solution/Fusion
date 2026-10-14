using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Domain.Calibration;

public enum CalibrationSessionState { Open = 0, Finalized = 1 }

public enum CalibrationDiscussionState { NotDiscussed = 0, Discussed = 1 }

/// <summary>An account that holds the calibrate grant. Tenant administrators may have no employee record.</summary>
public sealed record FacilitatorIdentity(Guid UserId, Guid? EmployeeId, string DisplayName);

/// <summary>
/// The one calibration session of a calibration-enabled review round. Subjects live in their
/// own rows with their own versions, so facilitators editing different subjects never collide;
/// the session version guards facilitator changes and finalization.
/// </summary>
public sealed class CalibrationSession : PerformanceAggregate
{
    private CalibrationSession() { }
    private readonly List<CalibrationFacilitator> _facilitators = [];

    public Guid ReviewRoundId { get; private set; }
    public Guid CycleId { get; private set; }
    public CalibrationSessionState State { get; private set; }
    public Guid OpenedByUserId { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public Guid? FinalizedByUserId { get; private set; }
    public DateTime? FinalizedAt { get; private set; }

    /// <summary>When facilitators were told every review reached calibration; set once.</summary>
    public DateTime? ReadyNotifiedAt { get; private set; }

    public IReadOnlyList<CalibrationFacilitator> Facilitators => _facilitators;

    public static CalibrationSession Open(Guid tenantId, ReviewRound round, FacilitatorIdentity opener, DateTime openedAt)
    {
        ArgumentNullException.ThrowIfNull(round);
        if (round.State != ReviewRoundState.Active)
            throw new InvalidOperationException("Calibration can only be opened for an Active review round.");
        if (!round.CalibrationEnabled)
            throw new InvalidOperationException("This review round does not use calibration.");
        var session = new CalibrationSession
        {
            TenantId = tenantId,
            ReviewRoundId = round.Id,
            CycleId = round.CycleId,
            State = CalibrationSessionState.Open,
            OpenedByUserId = opener.UserId,
            OpenedAt = openedAt,
        };
        session._facilitators.Add(CalibrationFacilitator.Name(session, opener, opener.UserId, openedAt));
        return session;
    }

    public bool IsFacilitator(Guid userId) => userId != Guid.Empty && _facilitators.Any(item => item.UserId == userId);

    /// <summary>Replaces the named facilitators. Callers verify each one holds the calibrate grant.</summary>
    public void ReplaceFacilitators(IReadOnlyList<FacilitatorIdentity> facilitators, Guid actorUserId, DateTime at)
    {
        RequireOpen();
        if (facilitators.Count == 0) throw new ArgumentException("A session needs at least one facilitator.", nameof(facilitators));
        if (facilitators.Select(item => item.UserId).Distinct().Count() != facilitators.Count)
            throw new ArgumentException("Each facilitator can be named once.", nameof(facilitators));
        _facilitators.RemoveAll(existing => facilitators.All(item => item.UserId != existing.UserId));
        foreach (var facilitator in facilitators.Where(item => !IsFacilitator(item.UserId)))
            _facilitators.Add(CalibrationFacilitator.Name(this, facilitator, actorUserId, at));
        MarkUpdated();
    }

    public CalibrationSubject AddSubject(PerformanceReview review)
    {
        RequireOpen();
        if (review.ReviewRoundId != ReviewRoundId || review.TenantId != TenantId)
            throw new ArgumentException("Only reviews of this round can join its calibration.", nameof(review));
        if (review.State != PerformanceReviewState.Calibration || review.ManagerAssessment.OverallRating is not int original)
            throw new InvalidOperationException("Only a review with a submitted manager rating can join calibration.");
        return CalibrationSubject.Create(this, review, original);
    }

    /// <summary>Records that facilitators were told; returns false when they already were.</summary>
    public bool MarkReadyNotified(DateTime at)
    {
        if (ReadyNotifiedAt is not null) return false;
        ReadyNotifiedAt = at;
        MarkUpdated();
        return true;
    }

    public bool Finalize(Guid actorUserId, DateTime at)
    {
        if (State == CalibrationSessionState.Finalized) return false;
        State = CalibrationSessionState.Finalized;
        FinalizedByUserId = actorUserId;
        FinalizedAt = at;
        MarkUpdated();
        return true;
    }

    internal void RequireOpen()
    {
        if (State != CalibrationSessionState.Open) throw new InvalidOperationException("This calibration session is finalized.");
    }
}

public sealed class CalibrationFacilitator : PerformanceChildEntity
{
    private CalibrationFacilitator() { }

    public Guid SessionId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid? EmployeeId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public Guid NamedByUserId { get; private set; }
    public DateTime NamedAt { get; private set; }

    internal static CalibrationFacilitator Name(CalibrationSession session, FacilitatorIdentity identity, Guid namedBy, DateTime at)
    {
        if (identity.UserId == Guid.Empty) throw new ArgumentException("A facilitator requires an account.", nameof(identity));
        return new CalibrationFacilitator
        {
            TenantId = session.TenantId,
            SessionId = session.Id,
            UserId = identity.UserId,
            EmployeeId = identity.EmployeeId,
            DisplayName = string.IsNullOrWhiteSpace(identity.DisplayName) ? "Facilitator" : identity.DisplayName.Trim(),
            NamedByUserId = namedBy,
            NamedAt = at,
        };
    }
}

/// <summary>One review under calibration. The original rating is the manager's submitted rating and never changes.</summary>
public sealed class CalibrationSubject : PerformanceChildEntity
{
    private CalibrationSubject() { }

    public Guid SessionId { get; private set; }
    public Guid ReviewId { get; private set; }
    public int OriginalRating { get; private set; }
    public int? CalibratedRating { get; private set; }
    public string? Rationale { get; private set; }
    public CalibrationDiscussionState DiscussionState { get; private set; }
    public uint Version { get; private set; }

    public int CurrentRating => CalibratedRating ?? OriginalRating;
    public bool IsAdjusted => CalibratedRating is not null;

    internal static CalibrationSubject Create(CalibrationSession session, PerformanceReview review, int originalRating) => new()
    {
        TenantId = session.TenantId,
        SessionId = session.Id,
        ReviewId = review.Id,
        OriginalRating = originalRating,
        DiscussionState = CalibrationDiscussionState.NotDiscussed,
    };

    /// <summary>
    /// Sets the subject's rating and discussion state. A rating that differs from the original
    /// needs a rationale; returning to the original clears the calibrated rating. Returns the
    /// history entry when the rating or its rationale changed.
    /// </summary>
    public CalibrationAdjustment? Apply(CalibrationSession session, int rating, string? rationale,
        CalibrationDiscussionState discussion, IReadOnlyCollection<int> scale, FacilitatorIdentity actor, DateTime at)
    {
        session.RequireOpen();
        if (session.Id != SessionId) throw new ArgumentException("The subject belongs to another session.", nameof(session));
        if (!scale.Contains(rating)) throw new ArgumentException("The rating must be a level of this round's scale.", nameof(rating));
        var cleaned = string.IsNullOrWhiteSpace(rationale) ? null : rationale.Trim();
        if (cleaned is { Length: > 2000 }) throw new ArgumentException("A rationale cannot exceed 2,000 characters.", nameof(rationale));
        var calibrated = rating == OriginalRating ? (int?)null : rating;
        if (calibrated is not null && cleaned is null)
            throw new ArgumentException("Explain why this rating differs from the manager's.", nameof(rationale));

        var previous = CurrentRating;
        var nextRationale = calibrated is null ? null : cleaned;
        CalibrationAdjustment? adjustment = null;
        if (previous != rating || (calibrated is not null && nextRationale != Rationale))
            adjustment = CalibrationAdjustment.Record(this, actor, previous, rating, cleaned, at);
        CalibratedRating = calibrated;
        Rationale = nextRationale;
        DiscussionState = discussion;
        MarkUpdated();
        return adjustment;
    }

    /// <summary>
    /// Touches the row at session finalization so its version moves: an adjustment read
    /// before finalization then fails its version check instead of landing afterwards.
    /// </summary>
    public void Seal() => MarkUpdated();
}

/// <summary>Append-only history of a subject's rating changes.</summary>
public sealed class CalibrationAdjustment : PerformanceChildEntity
{
    private CalibrationAdjustment() { }

    public Guid SessionId { get; private set; }
    public Guid SubjectId { get; private set; }
    public Guid ReviewId { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string ActorDisplayName { get; private set; } = string.Empty;
    public DateTime At { get; private set; }
    public int PreviousRating { get; private set; }
    public int NewRating { get; private set; }
    public string? Rationale { get; private set; }

    internal static CalibrationAdjustment Record(CalibrationSubject subject, FacilitatorIdentity actor,
        int previous, int next, string? rationale, DateTime at) => new()
    {
        TenantId = subject.TenantId,
        SessionId = subject.SessionId,
        SubjectId = subject.Id,
        ReviewId = subject.ReviewId,
        ActorUserId = actor.UserId,
        ActorDisplayName = actor.DisplayName,
        At = at,
        PreviousRating = previous,
        NewRating = next,
        Rationale = rationale,
    };
}
