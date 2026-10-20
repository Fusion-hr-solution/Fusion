using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Identity;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Calibration;

public sealed record ListCalibrationRoundsQuery(Guid CycleId, Guid UserId, bool HasGrant = false, Guid? EmployeeId = null) : IQuery<Result<IReadOnlyList<CalibrationRoundDto>>>;
/// <summary>A calibration-enabled round as a calibrator sees it from Reviews. Counts only for a session they sit on.</summary>
public sealed record CalibrationRoundDto(Guid ReviewRoundId, Guid CycleId, string ReviewRoundName, ReviewRoundState RoundState,
    CalibrationSessionState? SessionState, bool IsFacilitator, int? Subjects, int? Discussed);
public sealed record GetCalibrationSessionQuery(Guid RoundId, FacilitatorIdentity Actor, bool HasGrant = false) : IQuery<Result<CalibrationSessionDto>>;
public sealed record OpenCalibrationSessionCommand(Guid RoundId, FacilitatorIdentity Actor, bool HasGrant = false) : ICommand<Result<CalibrationSessionDto>>;
public sealed record ListFacilitatorCandidatesQuery(Guid RoundId, bool HasGrant = false) : IQuery<Result<IReadOnlyList<FacilitatorCandidateDto>>>;
public sealed record SetCalibrationFacilitatorsCommand(Guid RoundId, FacilitatorIdentity Actor, IReadOnlyList<Guid> UserIds, uint ExpectedVersion, bool HasGrant = false)
    : ICommand<Result<CalibrationSessionDto>>;
public sealed record AdjustCalibrationSubjectCommand(Guid RoundId, Guid ReviewId, FacilitatorIdentity Actor, int Rating, string? Rationale,
    CalibrationDiscussionState DiscussionState, uint ExpectedVersion, bool HasGrant = false, ReviewPotential? Potential = null)
    : ICommand<Result<CalibrationSubjectDto>>;
public sealed record FinalizeCalibrationSessionCommand(Guid RoundId, FacilitatorIdentity Actor, uint ExpectedVersion, bool HasGrant = false)
    : ICommand<Result<CalibrationSessionDto>>;

public sealed record SetCalibrationFacilitatorsRequest(IReadOnlyList<Guid> UserIds, uint ExpectedVersion);
/// <summary>Potential omitted leaves it as it is.</summary>
public sealed record AdjustCalibrationSubjectRequest(int Rating, string? Rationale, CalibrationDiscussionState DiscussionState, uint ExpectedVersion,
    ReviewPotential? Potential = null);

public sealed record FacilitatorCandidateDto(Guid UserId, string DisplayName);
public sealed record CalibrationFacilitatorDto(Guid UserId, string DisplayName, DateTime NamedAt);
public sealed record CalibrationCountsDto(int Subjects, int Discussed, int Adjusted, int Remaining, int Outstanding);
public sealed record CalibrationDistributionDto(int Value, string Label, int Original, int Current);
public sealed record CalibrationAdjustmentDto(Guid Id, string ActorDisplayName, DateTime At, int PreviousRating, int NewRating, string? Rationale,
    ReviewPotential? PreviousPotential = null, ReviewPotential? NewPotential = null);
public sealed record CalibrationSubjectDto(Guid ReviewId, string SubjectDisplayName, string ReviewerDisplayName,
    string? OrgUnitName, string? JobTitle, PerformanceReviewState ReviewState, int OriginalRating, int? CalibratedRating, int CurrentRating, bool Adjusted,
    string? Rationale, CalibrationDiscussionState DiscussionState, uint Version, IReadOnlyList<CalibrationAdjustmentDto> History)
{
    public ReviewPotential? OriginalPotential { get; init; }
    public ReviewPotential? CurrentPotential { get; init; }
    public bool PotentialAdjusted { get; init; }
}
/// <summary>What a stale change ran into: the subject as it stands and who changed it last.</summary>
public sealed record CalibrationConflictDto(CalibrationSubjectDto Current, string? ChangedBy, DateTime? ChangedAt);
public sealed record CalibrationOutstandingReviewDto(Guid ReviewId, string SubjectDisplayName, string ReviewerDisplayName, PerformanceReviewState State);
public sealed record CalibrationSessionDto(Guid Id, Guid ReviewRoundId, Guid CycleId, string ReviewRoundName,
    CalibrationSessionState State, uint Version, DateTime OpenedAt, DateTime? FinalizedAt,
    IReadOnlyList<CalibrationFacilitatorDto> Facilitators, CalibrationCountsDto Counts,
    IReadOnlyList<ReviewRatingLevelDto> RatingScale, IReadOnlyList<CalibrationDistributionDto> Distribution,
    IReadOnlyList<CalibrationOutstandingReviewDto> Outstanding)
{
    /// <summary>The shared header of the three views: counts, flags, bands, outstanding reviews by reviewer, filter options.</summary>
    public CalibrationHeaderDto? Header { get; init; }
}

/// <summary>Session membership, readiness and projection shared by the handlers and the review workflow.</summary>
internal static class CalibrationSessions
{
    public static Error NotFacilitator() => PerformanceErrors.Forbidden(PerformanceErrors.Codes.CalibrationForbidden,
        "You are not a facilitator of this calibration session.");

    public static Task<CalibrationSession?> FindAsync(PerformanceDbContext db, Guid roundId, CancellationToken token)
        => db.CalibrationSessions.FirstOrDefaultAsync(session => session.ReviewRoundId == roundId, token);

    /// <summary>
    /// Adds a review that just reached calibration to its round's open session, then tells the
    /// facilitators once every non-closed review has arrived. A round without a session yet
    /// picks its reviews up when the session opens.
    /// </summary>
    public static async Task JoinAsync(PerformanceDbContext db, PerformanceReview review, IPerformanceNotifications notifications,
        CancellationToken token)
    {
        var session = await FindAsync(db, review.ReviewRoundId, token);
        if (session is null || session.State != CalibrationSessionState.Open) return;
        if (review.State == PerformanceReviewState.Calibration
            && !await db.CalibrationSubjects.AnyAsync(subject => subject.SessionId == session.Id && subject.ReviewId == review.Id, token))
            db.CalibrationSubjects.Add(session.AddSubject(review));
        await NotifyIfReadyAsync(db, session, notifications, token);
    }

    public static async Task NotifyIfReadyAsync(PerformanceDbContext db, CalibrationSession session,
        IPerformanceNotifications notifications, CancellationToken token)
    {
        if (session.ReadyNotifiedAt is not null || await OutstandingAsync(db, session.ReviewRoundId, token) > 0) return;
        if (!session.MarkReadyNotified(DateTime.UtcNow)) return;
        var roundName = await db.ReviewRounds.Where(round => round.Id == session.ReviewRoundId).Select(round => round.Name).SingleAsync(token);
        notifications.EnqueueCalibrationReady(session, roundName);
    }

    /// <summary>
    /// Re-checks readiness once a submission or closure has committed. Two last submissions committing
    /// together each see the other outstanding inside their own transaction; after commit at least one
    /// sees none left. The session's version and the outbox dedupe key let only one of them notify.
    /// </summary>
    public static async Task ConfirmReadyAfterCommitAsync(PerformanceDbContext db, Guid roundId,
        IPerformanceNotifications notifications, CancellationToken token)
    {
        // Untracked: reviews loaded earlier in this context still hold their pre-commit state.
        if (await db.PerformanceReviews.AsNoTracking().AnyAsync(review => review.ReviewRoundId == roundId
                && (review.State == PerformanceReviewState.SelfAssessment || review.State == PerformanceReviewState.ManagerAssessment), token))
            return;
        var session = await FindAsync(db, roundId, token);
        if (session is null) return;
        await db.Entry(session).ReloadAsync(token);
        if (session.State != CalibrationSessionState.Open || !session.MarkReadyNotified(DateTime.UtcNow)) return;
        var roundName = await db.ReviewRounds.Where(round => round.Id == roundId).Select(round => round.Name).SingleAsync(token);
        notifications.EnqueueCalibrationReady(session, roundName);
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            // Another commit told the facilitators first.
        }
    }

    /// <summary>Reviews tracked locally count with their in-memory state, so a pending submission is seen.</summary>
    private static async Task<int> OutstandingAsync(PerformanceDbContext db, Guid roundId, CancellationToken token)
    {
        var reviews = await db.PerformanceReviews.Where(review => review.ReviewRoundId == roundId).ToListAsync(token);
        return reviews.Count(review => review.State is PerformanceReviewState.SelfAssessment or PerformanceReviewState.ManagerAssessment);
    }

    /// <summary>The tenant's bands for this scale; bands set for an earlier scale that no longer fit fall back to the default.</summary>
    public static NineBoxBands BandsFor(CycleSettings? settings, IReadOnlyList<int> scale)
    {
        try { return NineBoxBands.Resolve(settings?.NineBoxLowTop, settings?.NineBoxMidTop, scale); }
        catch (ArgumentException) { return NineBoxBands.Default(scale); }
    }

    public static async Task<IReadOnlyList<int>> ScaleValuesAsync(PerformanceDbContext db, ReviewRound round, CancellationToken token)
        => (await LevelsAsync(db, round, token)).Select(level => level.Value).ToArray();

    private static async Task<IReadOnlyList<RatingScaleLevel>> LevelsAsync(PerformanceDbContext db, ReviewRound round, CancellationToken token)
    {
        if (round.RatingScaleVersionId is not Guid versionId) return [];
        var version = await db.RatingScaleVersions.AsNoTracking().FirstOrDefaultAsync(item => item.Id == versionId, token);
        return version?.Levels ?? [];
    }

    /// <summary>
    /// The session as one facilitator sees it. A facilitator who is also a subject of the round never
    /// receives their own review: no row, history, outstanding entry or share of the counts and
    /// distribution, so nothing about their provisional rating can be read or inferred.
    /// </summary>
    public static async Task<CalibrationSessionDto> ProjectAsync(PerformanceDbContext db, CalibrationSession session, ReviewRound round,
        FacilitatorIdentity viewer, CancellationToken token)
    {
        var levels = await LevelsAsync(db, round, token);
        var reviews = (await db.PerformanceReviews.AsNoTracking().Where(review => review.ReviewRoundId == round.Id).ToListAsync(token))
            .Where(review => !IsOwn(review, viewer)).ToList();
        var subjects = await db.CalibrationSubjects.AsNoTracking().Where(subject => subject.SessionId == session.Id).ToListAsync(token);
        var history = await db.CalibrationAdjustments.AsNoTracking().Where(item => item.SessionId == session.Id)
            .OrderBy(item => item.At).ToListAsync(token);
        var reviewById = reviews.ToDictionary(review => review.Id);
        var subjectDtos = subjects
            .Where(subject => reviewById.ContainsKey(subject.ReviewId))
            .Select(subject => ToDto(subject, reviewById[subject.ReviewId], history))
            .OrderBy(subject => subject.SubjectDisplayName, StringComparer.OrdinalIgnoreCase).ToArray();
        var counted = subjectDtos.Where(subject => subject.ReviewState != PerformanceReviewState.Closed).ToArray();
        var outstanding = reviews
            .Where(review => review.State is PerformanceReviewState.SelfAssessment or PerformanceReviewState.ManagerAssessment)
            .OrderBy(review => review.SubjectDisplayName, StringComparer.OrdinalIgnoreCase)
            .Select(review => new CalibrationOutstandingReviewDto(review.Id, review.SubjectDisplayName, review.ReviewerDisplayName, review.State))
            .ToArray();
        var discussed = counted.Count(subject => subject.DiscussionState == CalibrationDiscussionState.Discussed);

        return new CalibrationSessionDto(session.Id, round.Id, round.CycleId, round.Name, session.State, session.Version,
            session.OpenedAt, session.FinalizedAt,
            session.Facilitators.OrderBy(item => item.NamedAt).Select(item => new CalibrationFacilitatorDto(item.UserId, item.DisplayName, item.NamedAt)).ToArray(),
            new CalibrationCountsDto(counted.Length, discussed, counted.Count(subject => subject.Adjusted), counted.Length - discussed, outstanding.Length),
            levels.Select(level => new ReviewRatingLevelDto(level.Value, level.Label, level.Description)).ToArray(),
            levels.Select(level => new CalibrationDistributionDto(level.Value, level.Label,
                counted.Count(subject => subject.OriginalRating == level.Value),
                counted.Count(subject => subject.CurrentRating == level.Value))).ToArray(),
            outstanding);
    }

    public static bool IsOwn(PerformanceReview review, FacilitatorIdentity actor)
        => actor.EmployeeId is Guid employeeId && employeeId != Guid.Empty && review.SubjectEmployeeId == employeeId;

    public static CalibrationSubjectDto ToDto(CalibrationSubject subject, PerformanceReview review, IEnumerable<CalibrationAdjustment> history)
        => new(subject.ReviewId, review.SubjectDisplayName, review.ReviewerDisplayName, review.SubjectOrgUnitName, review.SubjectJobTitle, review.State,
            subject.OriginalRating, subject.CalibratedRating, subject.CurrentRating, subject.IsAdjusted, subject.Rationale,
            subject.DiscussionState, subject.Version,
            history.Where(item => item.SubjectId == subject.Id).OrderBy(item => item.At)
                .Select(item => new CalibrationAdjustmentDto(item.Id, item.ActorDisplayName, item.At, item.PreviousRating, item.NewRating, item.Rationale,
                    item.PreviousPotential, item.NewPotential))
                .ToArray())
        {
            OriginalPotential = subject.OriginalPotential,
            CurrentPotential = subject.CurrentPotential,
            PotentialAdjusted = subject.IsPotentialAdjusted,
        };

    /// <summary>A stale change is refused, never merged: the facilitator sees what the other one did.</summary>
    public static async Task<Error> ConflictAsync(PerformanceDbContext db, CalibrationSubject subject, PerformanceReview review, CancellationToken token)
    {
        var history = await db.CalibrationAdjustments.AsNoTracking().Where(item => item.SubjectId == subject.Id).ToListAsync(token);
        var last = history.OrderByDescending(item => item.At).FirstOrDefault();
        return PerformanceErrors.Create(PerformanceErrors.Codes.CalibrationConflict,
            last is null ? "Someone changed this person since you opened them." : $"{last.ActorDisplayName} changed this person since you opened them.",
            FailureKind.Stale, new CalibrationConflictDto(ToDto(subject, review, history), last?.ActorDisplayName, last?.At));
    }
}

public sealed class ListCalibrationRoundsHandler(PerformanceDbContext db)
    : IQueryHandler<ListCalibrationRoundsQuery, Result<IReadOnlyList<CalibrationRoundDto>>>
{
    public async Task<Result<IReadOnlyList<CalibrationRoundDto>>> Handle(ListCalibrationRoundsQuery query, CancellationToken token)
    {
        if (!CalibrationPolicy.CanListRounds(query.HasGrant))
            return Result.Failure<IReadOnlyList<CalibrationRoundDto>>(PerformanceErrors.Forbidden(
                PerformanceErrors.Codes.CalibrationForbidden, "You do not have calibration permission."));
        if (!await db.Cycles.AnyAsync(cycle => cycle.Id == query.CycleId, token))
            return Result.Failure<IReadOnlyList<CalibrationRoundDto>>(PerformanceErrors.NotFound("Cycle", query.CycleId));
        var rounds = await db.ReviewRounds.AsNoTracking()
            .Where(round => round.CycleId == query.CycleId && round.CalibrationEnabled && round.State != ReviewRoundState.Draft)
            .OrderBy(round => round.PeriodEnd).ToListAsync(token);
        var roundIds = rounds.Select(round => round.Id).ToArray();
        var sessions = await db.CalibrationSessions.AsNoTracking().Where(session => roundIds.Contains(session.ReviewRoundId)).ToListAsync(token);
        var seated = sessions.Where(session => CalibrationPolicy.CanView(query.HasGrant, session, query.UserId)).Select(session => session.Id).ToArray();
        // The caller's own review is not theirs to count, as in the session itself.
        var ownReviewIds = query.EmployeeId is Guid employeeId && employeeId != Guid.Empty
            ? await db.PerformanceReviews.Where(review => roundIds.Contains(review.ReviewRoundId) && review.SubjectEmployeeId == employeeId)
                .Select(review => review.Id).ToListAsync(token)
            : [];
        var subjects = await db.CalibrationSubjects.AsNoTracking()
            .Where(subject => seated.Contains(subject.SessionId) && !ownReviewIds.Contains(subject.ReviewId))
            .GroupBy(subject => subject.SessionId)
            .Select(group => new { group.Key, Total = group.Count(), Discussed = group.Count(item => item.DiscussionState == CalibrationDiscussionState.Discussed) })
            .ToDictionaryAsync(item => item.Key, token);
        return Result.Success<IReadOnlyList<CalibrationRoundDto>>(rounds.Select(round =>
        {
            var session = sessions.FirstOrDefault(item => item.ReviewRoundId == round.Id);
            var isFacilitator = session is not null && CalibrationPolicy.CanView(query.HasGrant, session, query.UserId);
            var counts = isFacilitator && subjects.TryGetValue(session!.Id, out var found) ? found : null;
            return new CalibrationRoundDto(round.Id, round.CycleId, round.Name, round.State, session?.State, isFacilitator,
                isFacilitator ? counts?.Total ?? 0 : null, isFacilitator ? counts?.Discussed ?? 0 : null);
        }).ToArray());
    }
}

public sealed class GetCalibrationSessionHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationSessionQuery, Result<CalibrationSessionDto>>
{
    public async Task<Result<CalibrationSessionDto>> Handle(GetCalibrationSessionQuery query, CancellationToken token)
    {
        var round = await db.ReviewRounds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == query.RoundId, token);
        if (round is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("ReviewRound", query.RoundId));
        var session = await db.CalibrationSessions.AsNoTracking().FirstOrDefaultAsync(item => item.ReviewRoundId == round.Id, token);
        if (session is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("CalibrationSession", round.Id));
        if (!CalibrationPolicy.CanView(query.HasGrant, session, query.Actor.UserId)) return Result.Failure<CalibrationSessionDto>(CalibrationSessions.NotFacilitator());
        var model = await CalibrationReadModel.LoadAsync(db, round.Id, query.Actor, query.HasGrant, token);
        return Result.Success(await CalibrationSessions.ProjectAsync(db, session, round, query.Actor, token) with { Header = model.Value.Header() });
    }
}

public sealed class OpenCalibrationSessionHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<OpenCalibrationSessionCommand, Result<CalibrationSessionDto>>
{
    public async Task<Result<CalibrationSessionDto>> Handle(OpenCalibrationSessionCommand command, CancellationToken token)
    {
        var round = await db.ReviewRounds.FirstOrDefaultAsync(item => item.Id == command.RoundId, token);
        if (round is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("ReviewRound", command.RoundId));
        if (!CalibrationPolicy.CanOpen(command.HasGrant))
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.CalibrationForbidden, "You cannot open calibration for this review round."));
        if (await CalibrationSessions.FindAsync(db, round.Id, token) is { } existing)
        {
            if (!CalibrationPolicy.CanView(command.HasGrant, existing, command.Actor.UserId))
                return Result.Failure<CalibrationSessionDto>(CalibrationSessions.NotFacilitator());
            return Result.Success(await CalibrationSessions.ProjectAsync(db, existing, round, command.Actor, token));
        }

        var scale = await CalibrationSessions.ScaleValuesAsync(db, round, token);
        if (scale.Count < 3)
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationNotAvailable,
                "This review round has no rating scale to calibrate against."));
        var settings = await db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(token);
        CalibrationSession session;
        try { session = CalibrationSession.Open(round.TenantId, round, command.Actor, CalibrationSessions.BandsFor(settings, scale), DateTime.UtcNow); }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationNotAvailable, ex.Message));
        }
        db.CalibrationSessions.Add(session);
        var arrived = await db.PerformanceReviews.Where(review => review.ReviewRoundId == round.Id
            && review.State == PerformanceReviewState.Calibration).ToListAsync(token);
        foreach (var review in arrived) db.CalibrationSubjects.Add(session.AddSubject(review));
        audit.Record(session.TenantId, "CalibrationSession", session.Id, session.CycleId, PerformanceAuditActions.CalibrationOpened,
            new { reviewRoundId = round.Id, subjects = arrived.Count });
        await CalibrationSessions.NotifyIfReadyAsync(db, session, notifications, token);
        await db.SaveChangesAsync(token);
        return Result.Success(await CalibrationSessions.ProjectAsync(db, session, round, command.Actor, token));
    }
}

public sealed class ListFacilitatorCandidatesHandler(PerformanceDbContext db, IPermissionHoldersClient holders)
    : IQueryHandler<ListFacilitatorCandidatesQuery, Result<IReadOnlyList<FacilitatorCandidateDto>>>
{
    public async Task<Result<IReadOnlyList<FacilitatorCandidateDto>>> Handle(ListFacilitatorCandidatesQuery query, CancellationToken token)
    {
        if (!CalibrationPolicy.CanListFacilitatorCandidates(query.HasGrant)) return Result.Failure<IReadOnlyList<FacilitatorCandidateDto>>(PerformanceErrors.Forbidden(
            PerformanceErrors.Codes.CalibrationForbidden, "You do not have calibration permission."));
        if (!await db.ReviewRounds.AnyAsync(round => round.Id == query.RoundId, token))
            return Result.Failure<IReadOnlyList<FacilitatorCandidateDto>>(PerformanceErrors.NotFound("ReviewRound", query.RoundId));
        var list = await holders.GetHoldersAsync(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant, token);
        return Result.Success<IReadOnlyList<FacilitatorCandidateDto>>(list.Select(item => new FacilitatorCandidateDto(item.UserId, item.DisplayName)).ToArray());
    }
}

public sealed class SetCalibrationFacilitatorsHandler(PerformanceDbContext db, IPermissionHoldersClient holders, IPerformanceAudit audit)
    : ICommandHandler<SetCalibrationFacilitatorsCommand, Result<CalibrationSessionDto>>
{
    public async Task<Result<CalibrationSessionDto>> Handle(SetCalibrationFacilitatorsCommand command, CancellationToken token)
    {
        var round = await db.ReviewRounds.FirstOrDefaultAsync(item => item.Id == command.RoundId, token);
        if (round is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("ReviewRound", command.RoundId));
        var session = await CalibrationSessions.FindAsync(db, round.Id, token);
        if (session is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("CalibrationSession", round.Id));
        if (!CalibrationPolicy.CanAdjust(command.HasGrant, session, command.Actor.UserId)) return Result.Failure<CalibrationSessionDto>(CalibrationSessions.NotFacilitator());
        if (VersionGuard.Check(session, command.ExpectedVersion) is { } stale) return Result.Failure<CalibrationSessionDto>(stale);
        // Every named user must hold the grant now, per Identity; an unverified ID is not a capability.
        var capable = (await holders.GetHoldersAsync(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant, token))
            .ToDictionary(holder => holder.UserId);
        if (command.UserIds.Any(id => !capable.ContainsKey(id)))
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CalibrationFacilitatorInvalid,
                "Every facilitator must hold the calibration permission."));
        var before = session.Facilitators.Select(item => item.UserId).ToArray();
        try
        {
            session.ReplaceFacilitators(command.UserIds.Select(id => new FacilitatorIdentity(id, capable[id].EmployeeId, capable[id].DisplayName)).ToArray(),
                command.Actor.UserId, DateTime.UtcNow);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CalibrationFacilitatorInvalid, ex.Message));
        }
        audit.Record(session.TenantId, "CalibrationSession", session.Id, session.CycleId, PerformanceAuditActions.CalibrationFacilitatorsChanged,
            new { before, after = session.Facilitators.Select(item => item.UserId).ToArray() });
        await db.SaveChangesAsync(token);
        return Result.Success(await CalibrationSessions.ProjectAsync(db, session, round, command.Actor, token));
    }
}

public sealed class AdjustCalibrationSubjectHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<AdjustCalibrationSubjectCommand, Result<CalibrationSubjectDto>>
{
    public async Task<Result<CalibrationSubjectDto>> Handle(AdjustCalibrationSubjectCommand command, CancellationToken token)
    {
        var round = await db.ReviewRounds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == command.RoundId, token);
        if (round is null) return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.NotFound("ReviewRound", command.RoundId));
        var session = await db.CalibrationSessions.AsNoTracking().FirstOrDefaultAsync(item => item.ReviewRoundId == round.Id, token);
        if (session is null) return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.NotFound("CalibrationSession", round.Id));
        if (!CalibrationPolicy.CanAdjust(command.HasGrant, session, command.Actor.UserId)) return Result.Failure<CalibrationSubjectDto>(CalibrationSessions.NotFacilitator());
        var subject = await db.CalibrationSubjects.FirstOrDefaultAsync(item => item.SessionId == session.Id && item.ReviewId == command.ReviewId, token);
        if (subject is null) return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.NotFound("CalibrationSubject", command.ReviewId));
        var review = await db.PerformanceReviews.AsNoTracking().SingleAsync(item => item.Id == subject.ReviewId, token);
        if (CalibrationSessions.IsOwn(review, command.Actor))
            return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.CalibrationForbidden,
                "You cannot calibrate your own review."));
        if (subject.Version != command.ExpectedVersion)
            return Result.Failure<CalibrationSubjectDto>(await CalibrationSessions.ConflictAsync(db, subject, review, token));
        if (review.State != PerformanceReviewState.Calibration)
            return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationInvalid,
                "This review is no longer in calibration."));
        if (command.Potential is not null && !round.PotentialEnabled)
            return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CalibrationPotentialDisabled,
                "This review round does not rate potential."));

        var before = new { rating = subject.CurrentRating, potential = subject.CurrentPotential?.ToString(), discussion = subject.DiscussionState.ToString() };
        CalibrationAdjustment? adjustment;
        try
        {
            adjustment = subject.Apply(session, command.Rating, command.Rationale, command.DiscussionState,
                await CalibrationSessions.ScaleValuesAsync(db, round, token), command.Actor, DateTime.UtcNow, command.Potential);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationFinalized, ex.Message));
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CalibrationSubjectDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.CalibrationInvalid, ex.Message));
        }
        if (adjustment is not null) db.CalibrationAdjustments.Add(adjustment);
        audit.Record(session.TenantId, "CalibrationSubject", subject.Id, session.CycleId, PerformanceAuditActions.CalibrationSubjectChanged,
            new
            {
                reviewId = subject.ReviewId, before,
                after = new { rating = subject.CurrentRating, potential = subject.CurrentPotential?.ToString(), discussion = subject.DiscussionState.ToString() },
                reason = subject.Rationale,
            });
        await db.SaveChangesAsync(token);
        var history = await db.CalibrationAdjustments.AsNoTracking().Where(item => item.SubjectId == subject.Id).ToListAsync(token);
        return Result.Success(CalibrationSessions.ToDto(subject, review, history));
    }
}

public sealed class FinalizeCalibrationSessionHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<FinalizeCalibrationSessionCommand, Result<CalibrationSessionDto>>
{
    public async Task<Result<CalibrationSessionDto>> Handle(FinalizeCalibrationSessionCommand command, CancellationToken token)
    {
        var round = await db.ReviewRounds.FirstOrDefaultAsync(item => item.Id == command.RoundId, token);
        if (round is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("ReviewRound", command.RoundId));
        var session = await CalibrationSessions.FindAsync(db, round.Id, token);
        if (session is null) return Result.Failure<CalibrationSessionDto>(PerformanceErrors.NotFound("CalibrationSession", round.Id));
        if (!CalibrationPolicy.CanFinalize(command.HasGrant, session, command.Actor.UserId)) return Result.Failure<CalibrationSessionDto>(CalibrationSessions.NotFacilitator());
        // A retry after success changes nothing, whatever version it carries.
        if (session.State == CalibrationSessionState.Finalized) return Result.Success(await CalibrationSessions.ProjectAsync(db, session, round, command.Actor, token));
        if (VersionGuard.Check(session, command.ExpectedVersion) is { } stale) return Result.Failure<CalibrationSessionDto>(stale);

        var reviews = await db.PerformanceReviews.Where(review => review.ReviewRoundId == round.Id).ToListAsync(token);
        var outstanding = reviews.Where(review => review.State is PerformanceReviewState.SelfAssessment or PerformanceReviewState.ManagerAssessment)
            .Select(review => new { review.Id, review.SubjectDisplayName, State = review.State.ToString() }).ToArray();
        if (outstanding.Length > 0)
            return Result.Failure<CalibrationSessionDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationOutstandingReviews,
                $"{outstanding.Length} review(s) have not reached calibration yet.", new { outstanding }));

        var subjects = await db.CalibrationSubjects.Where(subject => subject.SessionId == session.Id).ToListAsync(token);
        var byReview = subjects.ToDictionary(subject => subject.ReviewId);
        var calibrated = new List<PerformanceReview>();
        foreach (var review in reviews.Where(review => review.State == PerformanceReviewState.Calibration))
        {
            // A review can reach calibration before its session opened and miss the join; it joins now.
            if (!byReview.TryGetValue(review.Id, out var subject))
            {
                subject = session.AddSubject(review);
                db.CalibrationSubjects.Add(subject);
            }
            review.CompleteCalibration(subject.CurrentRating, subject.IsAdjusted, subject.CurrentPotential);
            subject.Seal();
            calibrated.Add(review);
        }
        session.Finalize(command.Actor.UserId, DateTime.UtcNow);
        // Each reviewer hears the outcome is in, with counts only (D-23): who changed and why stay in the app.
        foreach (var team in calibrated.GroupBy(review => review.ReviewerEmployeeId))
        {
            var first = team.First();
            var changed = team.Count(review => review.CalibrationChangedRating);
            var counts = changed == 0 ? "No ratings changed." : $"{changed} of {team.Count()} ratings changed.";
            notifications.EnqueueReviewWork(first, PerformanceNotificationKind.CalibrationFinalized, team.Key, "CalibrationSession", session.Id,
                $"{PerformanceNotificationKind.CalibrationFinalized}:{session.Id:N}:{team.Key:N}",
                new ReviewWorkNotificationPayload(round.CycleId, round.Id, first.Id, round.Name, PerformanceNotificationTemplates.ReviewsPath, Task: counts),
                PerformanceNotificationTemplates.ForCalibrationFinalized(round.Name, counts));
        }
        audit.Record(session.TenantId, "CalibrationSession", session.Id, session.CycleId, PerformanceAuditActions.CalibrationFinalized,
            new
            {
                before = CalibrationSessionState.Open.ToString(), after = session.State.ToString(),
                outcomes = subjects.Select(subject => new { subject.ReviewId, original = subject.OriginalRating, final = subject.CurrentRating }).ToArray(),
            });
        await db.SaveChangesAsync(token);
        return Result.Success(await CalibrationSessions.ProjectAsync(db, session, round, command.Actor, token));
    }
}
