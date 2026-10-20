using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace EY.HRPlatform.Performance.Features.Calibration;

// ----- Contracts: one projection per view of the session (D-39) -----

/// <summary>Filters shared by every view. Unit and manager options come from the subjects the viewer may see.</summary>
public sealed record CalibrationFilter(Guid? Unit = null, Guid? Manager = null, bool Flagged = false, bool NotDiscussed = false, string? Q = null);

/// <summary>A filter option; for a manager, flagged when their ratings sit far from the session's.</summary>
public sealed record CalibrationOptionDto(Guid Id, string Name, int Count, bool Flagged = false);
public sealed record CalibrationOutstandingGroupDto(Guid ReviewerId, string ReviewerName, int Count, IReadOnlyList<string> People);
public sealed record CalibrationHeaderDto(int People, int Discussed, int RatingChanged, int PotentialChanged, int Flags, int FlaggedNotDiscussed,
    int Outstanding, bool PotentialEnabled, int BandLowTop, int BandMidTop, IReadOnlyList<CalibrationOutstandingGroupDto> OutstandingByReviewer,
    IReadOnlyList<CalibrationOptionDto> Units, IReadOnlyList<CalibrationOptionDto> Managers);

/// <summary>A person flag as facts; the client words it. Attainment for a disagreement, the move and cycle for a move.</summary>
public sealed record CalibrationFlagDto(string Kind, decimal? Attainment = null, int? Moved = null, string? Cycle = null);
public sealed record CalibrationLastResultDto(int Rating, string CycleName);
public sealed record CalibrationPersonDto(Guid ReviewId, string Name, string? JobTitle, string? Unit, Guid ReviewerId, string ReviewerName,
    int OriginalRating, int CurrentRating, ReviewPotential? OriginalPotential, ReviewPotential? CurrentPotential, decimal? Attainment,
    CalibrationLastResultDto? LastResult, IReadOnlyList<CalibrationFlagDto> Flags, bool Discussed, uint Version);

public sealed record CalibrationLevelDto(int Value, string Label, int Original, int Current);
public sealed record CalibrationManagerDto(Guid ReviewerId, string ReviewerName, int Reviews, IReadOnlyList<int> OriginalMix, IReadOnlyList<int> CurrentMix,
    decimal OriginalAverage, decimal CurrentAverage, decimal Delta, bool Lenient);
public sealed record CalibrationDistributionViewDto(IReadOnlyList<CalibrationLevelDto> Levels, decimal SessionAverage, decimal CurrentAverage,
    IReadOnlyList<CalibrationManagerDto> Managers);

public sealed record CalibrationGroupDto(int Value, string Label, int Count, int OriginalCount, IReadOnlyList<CalibrationPersonDto> People);
public sealed record CalibrationPeopleViewDto(IReadOnlyList<CalibrationGroupDto> Groups, int Total);

public sealed record CalibrationCellPersonDto(Guid ReviewId, string Name, int CurrentRating, bool Moved, uint Version);
/// <summary>Band 0 is the low band, 2 the top; potential runs Developing, Growing, High.</summary>
public sealed record CalibrationCellDto(int Band, ReviewPotential Potential, IReadOnlyList<CalibrationCellPersonDto> People);
public sealed record CalibrationNineBoxViewDto(int BandLowTop, int BandMidTop, IReadOnlyList<CalibrationCellDto> Cells);

public sealed record CalibrationObjectiveDto(Guid Id, string Title, decimal? Weight, decimal? Progress, ObjectiveStatus? Status);
public sealed record CalibrationSubjectDetailDto(CalibrationPersonDto Person, IReadOnlyList<CalibrationObjectiveDto> Objectives,
    string? ManagerSummary, string? Rationale, IReadOnlyList<CalibrationAdjustmentDto> History, CalibrationManagerDto? Reviewer,
    IReadOnlyList<ReviewRatingLevelDto> Scale);

public sealed record CalibrationNamedFlagDto(Guid ReviewId, string Name, IReadOnlyList<CalibrationFlagDto> Flags);
public sealed record CalibrationFinalizePreviewDto(int People, int RatingsUp, int RatingsDown, int PotentialUp, int PotentialDown, int NotDiscussed,
    IReadOnlyList<CalibrationNamedFlagDto> FlaggedNotDiscussed, int Outstanding, int Reviewers);

public sealed record CalibrationChangeDto(Guid ReviewId, string Name, string ReviewerName, int OriginalRating, int FinalRating,
    ReviewPotential? OriginalPotential, ReviewPotential? FinalPotential, string? Reason, string? ChangedBy, DateTime? ChangedAt);
public sealed record CalibrationChangesViewDto(IReadOnlyList<CalibrationLevelDto> Levels, IReadOnlyList<CalibrationChangeDto> Changes,
    DateTime? FinalizedAt);

public sealed record GetCalibrationViewQuery<T>(Guid RoundId, FacilitatorIdentity Actor, CalibrationFilter Filter, bool HasGrant = false,
    Guid? ReviewId = null) : IQuery<Result<T>>;

// ----- Read model -----

/// <summary>
/// Everything a facilitator's views read, loaded once per request: the subjects they may see (never their own),
/// each with attainment, last released result and computed flags.
/// </summary>
internal sealed class CalibrationReadModel
{
    public sealed record Row(CalibrationSubject Subject, PerformanceReview Review, decimal? Attainment, InsightLastResult? Last, PersonInsight Insight);

    public required ReviewRound Round { get; init; }
    public required CalibrationSession Session { get; init; }
    public required IReadOnlyList<RatingScaleLevel> Levels { get; init; }
    public required IReadOnlyList<PerformanceReview> Reviews { get; init; }
    public required IReadOnlyList<Row> Rows { get; init; }
    public required CalibrationInsightSet Insights { get; init; }
    public required IReadOnlyList<CalibrationAdjustment> History { get; init; }

    public static async Task<Result<CalibrationReadModel>> LoadAsync(PerformanceDbContext db, Guid roundId, FacilitatorIdentity viewer, bool hasGrant,
        CancellationToken token)
    {
        var round = await db.ReviewRounds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == roundId, token);
        if (round is null) return Result.Failure<CalibrationReadModel>(PerformanceErrors.NotFound("ReviewRound", roundId));
        var session = await db.CalibrationSessions.AsNoTracking().FirstOrDefaultAsync(item => item.ReviewRoundId == round.Id, token);
        if (session is null) return Result.Failure<CalibrationReadModel>(PerformanceErrors.NotFound("CalibrationSession", round.Id));
        if (!CalibrationPolicy.CanView(hasGrant, session, viewer.UserId)) return Result.Failure<CalibrationReadModel>(CalibrationSessions.NotFacilitator());

        var levels = round.RatingScaleVersionId is Guid versionId
            ? (await db.RatingScaleVersions.AsNoTracking().FirstOrDefaultAsync(item => item.Id == versionId, token))?.Levels ?? []
            : [];
        var reviews = (await db.PerformanceReviews.AsNoTracking().Where(review => review.ReviewRoundId == round.Id).ToListAsync(token))
            .Where(review => !CalibrationSessions.IsOwn(review, viewer)).ToList();
        var reviewById = reviews.ToDictionary(review => review.Id);
        var subjects = (await db.CalibrationSubjects.AsNoTracking().Where(subject => subject.SessionId == session.Id).ToListAsync(token))
            .Where(subject => reviewById.TryGetValue(subject.ReviewId, out var review) && review.State != PerformanceReviewState.Closed).ToList();
        var history = await db.CalibrationAdjustments.AsNoTracking().Where(item => item.SessionId == session.Id).OrderBy(item => item.At).ToListAsync(token);

        var employees = subjects.Select(subject => reviewById[subject.ReviewId].SubjectEmployeeId).Distinct().ToArray();
        var attainment = await AttainmentAsync(db, round.CycleId, employees, token);
        var last = await LastResultsAsync(db, round.CycleId, employees, token);
        var inputs = subjects.Select(subject =>
        {
            var review = reviewById[subject.ReviewId];
            return new InsightSubject(subject.ReviewId, review.ReviewerEmployeeId, review.ReviewerDisplayName, subject.OriginalRating,
                subject.CurrentRating, attainment.GetValueOrDefault(review.SubjectEmployeeId), last.GetValueOrDefault(review.SubjectEmployeeId));
        }).ToArray();
        var insights = CalibrationInsights.Compute(inputs, session.Bands, Math.Max(levels.Count, 3));
        var rows = subjects.Select(subject =>
        {
            var review = reviewById[subject.ReviewId];
            return new Row(subject, review, attainment.GetValueOrDefault(review.SubjectEmployeeId), last.GetValueOrDefault(review.SubjectEmployeeId),
                insights.People[subject.ReviewId]);
        }).OrderBy(row => row.Review.SubjectDisplayName, StringComparer.OrdinalIgnoreCase).ToArray();

        return Result.Success(new CalibrationReadModel
        {
            Round = round, Session = session, Levels = levels, Reviews = reviews, Rows = rows, Insights = insights, History = history,
        });
    }

    /// <summary>Weighted attainment from each person's approved plan in the cycle, progress capped at 100%.</summary>
    private static async Task<Dictionary<Guid, decimal?>> AttainmentAsync(PerformanceDbContext db, Guid cycleId, Guid[] employees, CancellationToken token)
    {
        var plans = await db.EmployeePlans.AsNoTracking()
            .Where(plan => plan.CycleId == cycleId && employees.Contains(plan.EmployeeId) && plan.State == PlanLifecycleState.Approved)
            .Select(plan => new { plan.Id, plan.EmployeeId }).ToListAsync(token);
        var planIds = plans.Select(plan => plan.Id).ToArray();
        var objectives = await db.Objectives.AsNoTracking()
            .Where(objective => objective.EmployeePlanId != null && planIds.Contains(objective.EmployeePlanId.Value)
                && objective.State != ObjectiveLifecycleState.Archived).ToListAsync(token);
        return plans.ToDictionary(plan => plan.EmployeeId, plan => CalibrationInsights.Attainment(objectives
            .Where(objective => objective.EmployeePlanId == plan.Id)
            .Select(objective => (objective.PlanWeight ?? 0m, objective.HasProgress ? objective.DerivedProgress : 0m))));
    }

    /// <summary>The most recent released result per person in a cycle that started before this one.</summary>
    private static async Task<Dictionary<Guid, InsightLastResult?>> LastResultsAsync(PerformanceDbContext db, Guid cycleId, Guid[] employees,
        CancellationToken token)
    {
        var start = await db.Cycles.AsNoTracking().Where(cycle => cycle.Id == cycleId).Select(cycle => cycle.StartDate).SingleAsync(token);
        var earlier = await db.Cycles.AsNoTracking().Where(cycle => cycle.StartDate < start)
            .Select(cycle => new { cycle.Id, cycle.Name }).ToDictionaryAsync(cycle => cycle.Id, cycle => cycle.Name, token);
        var cycleIds = earlier.Keys.ToArray();
        var released = await db.PerformanceReviews.AsNoTracking()
            .Where(review => cycleIds.Contains(review.CycleId) && employees.Contains(review.SubjectEmployeeId)
                && review.State == PerformanceReviewState.Finalized && review.FinalRating != null)
            .Select(review => new { review.SubjectEmployeeId, review.CycleId, review.FinalRating, review.FinalizedAt, review.RatingScaleSnapshotJson })
            .ToListAsync(token);
        return released.GroupBy(review => review.SubjectEmployeeId).ToDictionary(group => group.Key, group =>
        {
            var latest = group.OrderByDescending(review => review.FinalizedAt).First();
            var levels = JsonSerializer.Deserialize<RatingScaleLevel[]>(latest.RatingScaleSnapshotJson)?.Length ?? 0;
            return (InsightLastResult?)new InsightLastResult(latest.FinalRating!.Value, levels, earlier[latest.CycleId]);
        });
    }

    public IEnumerable<Row> Filter(CalibrationFilter filter)
    {
        var q = filter.Q?.Trim();
        return Rows.Where(row => (filter.Unit is not Guid unit || row.Review.SubjectOrgUnitId == unit)
            && (filter.Manager is not Guid manager || row.Review.ReviewerEmployeeId == manager)
            && (!filter.Flagged || row.Insight.Flagged || IsLenient(row.Review.ReviewerEmployeeId))
            && (!filter.NotDiscussed || row.Subject.DiscussionState == CalibrationDiscussionState.NotDiscussed)
            && (string.IsNullOrEmpty(q) || row.Review.SubjectDisplayName.Contains(q, StringComparison.OrdinalIgnoreCase)));
    }

    public bool IsLenient(Guid reviewerId) => Insights.Managers.Any(manager => manager.ReviewerId == reviewerId && manager.Lenient);

    public CalibrationHeaderDto Header()
    {
        var outstanding = Reviews.Where(review => review.State is PerformanceReviewState.SelfAssessment or PerformanceReviewState.ManagerAssessment)
            .GroupBy(review => (review.ReviewerEmployeeId, review.ReviewerDisplayName))
            .Select(group => new CalibrationOutstandingGroupDto(group.Key.ReviewerEmployeeId, group.Key.ReviewerDisplayName, group.Count(),
                group.Select(review => review.SubjectDisplayName).Order(StringComparer.OrdinalIgnoreCase).ToArray()))
            .OrderByDescending(group => group.Count).ThenBy(group => group.ReviewerName, StringComparer.OrdinalIgnoreCase).ToArray();
        return new CalibrationHeaderDto(Rows.Count,
            Rows.Count(row => row.Subject.DiscussionState == CalibrationDiscussionState.Discussed),
            Rows.Count(row => row.Subject.IsAdjusted), Rows.Count(row => row.Subject.IsPotentialAdjusted),
            Insights.Flags,
            Rows.Count(row => row.Insight.Flagged && row.Subject.DiscussionState == CalibrationDiscussionState.NotDiscussed),
            outstanding.Sum(group => group.Count), Round.PotentialEnabled, Session.BandLowTop, Session.BandMidTop, outstanding,
            Rows.Where(row => row.Review.SubjectOrgUnitId is not null)
                .GroupBy(row => (row.Review.SubjectOrgUnitId!.Value, Name: row.Review.SubjectOrgUnitName ?? "Unit"))
                .Select(group => new CalibrationOptionDto(group.Key.Value, group.Key.Name, group.Count()))
                .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase).ToArray(),
            Rows.GroupBy(row => (row.Review.ReviewerEmployeeId, row.Review.ReviewerDisplayName))
                .Select(group => new CalibrationOptionDto(group.Key.ReviewerEmployeeId, group.Key.ReviewerDisplayName, group.Count(),
                    IsLenient(group.Key.ReviewerEmployeeId)))
                .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase).ToArray());
    }

    public CalibrationPersonDto Person(Row row) => new(row.Review.Id, row.Review.SubjectDisplayName, row.Review.SubjectJobTitle,
        row.Review.SubjectOrgUnitName, row.Review.ReviewerEmployeeId, row.Review.ReviewerDisplayName, row.Subject.OriginalRating,
        row.Subject.CurrentRating, row.Subject.OriginalPotential, row.Subject.CurrentPotential, row.Attainment,
        row.Last is { } last ? new CalibrationLastResultDto(last.Rating, last.CycleName) : null, Flags(row),
        row.Subject.DiscussionState == CalibrationDiscussionState.Discussed, row.Subject.Version);

    public static IReadOnlyList<CalibrationFlagDto> Flags(Row row)
    {
        var flags = new List<CalibrationFlagDto>();
        if (row.Insight.DisagreesWithObjectives) flags.Add(new("RatingVsObjectives", Attainment: row.Attainment));
        if (row.Insight.Moved) flags.Add(new("MovedSinceLastCycle", Moved: row.Insight.MovedSinceLast, Cycle: row.Last?.CycleName));
        return flags;
    }

    public CalibrationManagerDto Manager(ManagerInsight manager)
    {
        var team = Rows.Where(row => row.Review.ReviewerEmployeeId == manager.ReviewerId).ToArray();
        return new(manager.ReviewerId, manager.ReviewerName, manager.Reviews,
            Levels.Select(level => team.Count(row => row.Subject.OriginalRating == level.Value)).ToArray(),
            Levels.Select(level => team.Count(row => row.Subject.CurrentRating == level.Value)).ToArray(),
            Math.Round(manager.OriginalAverage, 2), Math.Round(manager.CurrentAverage, 2), Math.Round(manager.Delta, 2), manager.Lenient);
    }

    public IReadOnlyList<CalibrationLevelDto> LevelCounts(IEnumerable<Row> rows)
    {
        var list = rows.ToArray();
        return Levels.Select(level => new CalibrationLevelDto(level.Value, level.Label,
            list.Count(row => row.Subject.OriginalRating == level.Value), list.Count(row => row.Subject.CurrentRating == level.Value))).ToArray();
    }
}

// ----- Handlers -----

public sealed class GetCalibrationDistributionHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationDistributionViewDto>, Result<CalibrationDistributionViewDto>>
{
    public async Task<Result<CalibrationDistributionViewDto>> Handle(GetCalibrationViewQuery<CalibrationDistributionViewDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationDistributionViewDto>(loaded.Error);
        var model = loaded.Value;
        var rows = model.Filter(query.Filter).ToArray();
        var reviewers = rows.Select(row => row.Review.ReviewerEmployeeId).ToHashSet();
        return Result.Success(new CalibrationDistributionViewDto(model.LevelCounts(rows),
            Math.Round(model.Insights.SessionAverage, 2),
            rows.Length == 0 ? 0m : Math.Round(rows.Average(row => (decimal)row.Subject.CurrentRating), 2),
            model.Insights.Managers.Where(manager => reviewers.Contains(manager.ReviewerId)).Select(model.Manager).ToArray()));
    }
}

public sealed class GetCalibrationPeopleHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationPeopleViewDto>, Result<CalibrationPeopleViewDto>>
{
    public async Task<Result<CalibrationPeopleViewDto>> Handle(GetCalibrationViewQuery<CalibrationPeopleViewDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationPeopleViewDto>(loaded.Error);
        var model = loaded.Value;
        var rows = model.Filter(query.Filter).ToArray();
        var groups = model.Levels.OrderByDescending(level => level.Value).Select(level => new CalibrationGroupDto(level.Value, level.Label,
            rows.Count(row => row.Subject.CurrentRating == level.Value), rows.Count(row => row.Subject.OriginalRating == level.Value),
            rows.Where(row => row.Subject.CurrentRating == level.Value)
                .OrderByDescending(row => row.Insight.Flagged).ThenBy(row => row.Review.SubjectDisplayName, StringComparer.OrdinalIgnoreCase)
                .Select(model.Person).ToArray())).ToArray();
        return Result.Success(new CalibrationPeopleViewDto(groups, rows.Length));
    }
}

public sealed class GetCalibrationNineBoxHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationNineBoxViewDto>, Result<CalibrationNineBoxViewDto>>
{
    public async Task<Result<CalibrationNineBoxViewDto>> Handle(GetCalibrationViewQuery<CalibrationNineBoxViewDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationNineBoxViewDto>(loaded.Error);
        var model = loaded.Value;
        if (!model.Round.PotentialEnabled)
            return Result.Failure<CalibrationNineBoxViewDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CalibrationPotentialDisabled,
                "This review round does not rate potential."));
        var bands = model.Session.Bands;
        var rows = model.Filter(query.Filter).Where(row => row.Subject.CurrentPotential is not null).ToArray();
        var cells = (from potential in new[] { ReviewPotential.High, ReviewPotential.Growing, ReviewPotential.Developing }
                     from band in new[] { 0, 1, 2 }
                     select new CalibrationCellDto(band, potential, rows
                         .Where(row => row.Subject.CurrentPotential == potential && bands.BandOf(row.Subject.CurrentRating) == band)
                         .OrderBy(row => row.Review.SubjectDisplayName, StringComparer.OrdinalIgnoreCase)
                         .Select(row => new CalibrationCellPersonDto(row.Review.Id, row.Review.SubjectDisplayName, row.Subject.CurrentRating,
                             row.Subject.IsAdjusted || row.Subject.IsPotentialAdjusted, row.Subject.Version)).ToArray())).ToArray();
        return Result.Success(new CalibrationNineBoxViewDto(bands.LowTop, bands.MidTop, cells));
    }
}

public sealed class GetCalibrationSubjectDetailHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationSubjectDetailDto>, Result<CalibrationSubjectDetailDto>>
{
    public async Task<Result<CalibrationSubjectDetailDto>> Handle(GetCalibrationViewQuery<CalibrationSubjectDetailDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationSubjectDetailDto>(loaded.Error);
        var model = loaded.Value;
        // A facilitator's own review is not in their rows, so it reads as not found.
        var row = model.Rows.FirstOrDefault(item => item.Review.Id == query.ReviewId);
        if (row is null) return Result.Failure<CalibrationSubjectDetailDto>(PerformanceErrors.NotFound("CalibrationSubject", query.ReviewId ?? Guid.Empty));

        var plan = await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(item => item.CycleId == model.Round.CycleId
            && item.EmployeeId == row.Review.SubjectEmployeeId && item.State == PlanLifecycleState.Approved, token);
        var objectives = plan is null ? [] : await db.Objectives.AsNoTracking()
            .Where(item => item.EmployeePlanId == plan.Id && item.State != ObjectiveLifecycleState.Archived)
            .OrderByDescending(item => item.PlanWeight).ThenBy(item => item.Title).ToListAsync(token);
        var reviewer = model.Insights.Managers.FirstOrDefault(manager => manager.ReviewerId == row.Review.ReviewerEmployeeId);
        return Result.Success(new CalibrationSubjectDetailDto(model.Person(row),
            objectives.Select(objective => new CalibrationObjectiveDto(objective.Id, objective.Title, objective.PlanWeight,
                objective.HasProgress ? Math.Min(objective.DerivedProgress, 100m) : null, objective.CurrentStatus)).ToArray(),
            row.Review.ManagerAssessment.IsSubmitted ? row.Review.ManagerAssessment.Summary : null,
            row.Subject.Rationale,
            CalibrationSessions.ToDto(row.Subject, row.Review, model.History).History,
            reviewer is null ? null : model.Manager(reviewer),
            model.Levels.Select(level => new ReviewRatingLevelDto(level.Value, level.Label, level.Description)).ToArray()));
    }
}

public sealed class GetCalibrationFinalizePreviewHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationFinalizePreviewDto>, Result<CalibrationFinalizePreviewDto>>
{
    public async Task<Result<CalibrationFinalizePreviewDto>> Handle(GetCalibrationViewQuery<CalibrationFinalizePreviewDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationFinalizePreviewDto>(loaded.Error);
        var model = loaded.Value;
        var rows = model.Rows;
        var notDiscussed = rows.Where(row => row.Subject.DiscussionState == CalibrationDiscussionState.NotDiscussed).ToArray();
        return Result.Success(new CalibrationFinalizePreviewDto(rows.Count,
            rows.Count(row => row.Subject.CurrentRating > row.Subject.OriginalRating),
            rows.Count(row => row.Subject.CurrentRating < row.Subject.OriginalRating),
            rows.Count(row => row.Subject.IsPotentialAdjusted && row.Subject.CurrentPotential > row.Subject.OriginalPotential),
            rows.Count(row => row.Subject.IsPotentialAdjusted && row.Subject.CurrentPotential < row.Subject.OriginalPotential),
            notDiscussed.Length,
            notDiscussed.Where(row => row.Insight.Flagged)
                .Select(row => new CalibrationNamedFlagDto(row.Review.Id, row.Review.SubjectDisplayName, CalibrationReadModel.Flags(row))).ToArray(),
            model.Header().Outstanding,
            rows.Select(row => row.Review.ReviewerEmployeeId).Distinct().Count()));
    }
}

public sealed class GetCalibrationChangesHandler(PerformanceDbContext db)
    : IQueryHandler<GetCalibrationViewQuery<CalibrationChangesViewDto>, Result<CalibrationChangesViewDto>>
{
    public async Task<Result<CalibrationChangesViewDto>> Handle(GetCalibrationViewQuery<CalibrationChangesViewDto> query, CancellationToken token)
    {
        var loaded = await CalibrationReadModel.LoadAsync(db, query.RoundId, query.Actor, query.HasGrant, token);
        if (loaded.IsFailure) return Result.Failure<CalibrationChangesViewDto>(loaded.Error);
        var model = loaded.Value;
        var changes = model.Filter(query.Filter)
            .Where(row => row.Subject.IsAdjusted || row.Subject.IsPotentialAdjusted)
            .Select(row =>
            {
                var last = model.History.Where(item => item.SubjectId == row.Subject.Id).OrderByDescending(item => item.At).FirstOrDefault();
                return new CalibrationChangeDto(row.Review.Id, row.Review.SubjectDisplayName, row.Review.ReviewerDisplayName,
                    row.Subject.OriginalRating, row.Subject.CurrentRating, row.Subject.OriginalPotential, row.Subject.CurrentPotential,
                    row.Subject.Rationale, last?.ActorDisplayName, last?.At);
            })
            .OrderByDescending(change => Math.Abs(change.FinalRating - change.OriginalRating))
            .ThenBy(change => change.Name, StringComparer.OrdinalIgnoreCase).ToArray();
        return Result.Success(new CalibrationChangesViewDto(model.LevelCounts(model.Rows), changes, model.Session.FinalizedAt));
    }
}
