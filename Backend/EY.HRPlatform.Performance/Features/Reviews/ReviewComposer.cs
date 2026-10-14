using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Features;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record GetPerformanceReviewQuery(Guid ReviewId, ReviewActor Actor) : IQuery<Result<PerformanceReviewDto>>;
public sealed record ReviewAssessmentDto(string Summary, int? OverallRating, DateTime? SavedAt, DateTime? SubmittedAt);
public sealed record ReviewRatingLevelDto(int Value, string Label, string? Description);
public sealed record ReviewItemAssessmentDto(ReviewItemKind Kind, Guid ItemId, string Title, string? Description,
    IReadOnlyList<string> Behaviors, MeasurementDto? Measurement, bool HasProgress, decimal? Progress,
    int EvidenceCount, IReadOnlyList<ReviewEvidenceRefDto> EvidenceSummary, string? SelfReflection, int? SelfRating, string? SelfComment,
    string? ManagerAssessment, int? ManagerRating, string? LegacyMeasurementSummary = null);
public sealed record ReviewEvidenceRefDto(Guid? EvidenceId, EvidenceKind? Kind, string Label, DateTime? RecordedAt);
public sealed record PerformanceReviewDto(Guid Id, Guid ReviewRoundId, Guid CycleId, string ReviewRoundName,
    DateOnly PeriodStart, DateOnly PeriodEnd, string SubjectDisplayName, string ReviewerDisplayName,
    PerformanceReviewState State, DateOnly? DueDate, bool SelfAssessmentEnabled, bool CalibrationEnabled, bool CanEditSelfAssessment,
    bool CanEditManagerAssessment, uint Version, Guid RatingScaleVersionId, int RatingScaleVersion, IReadOnlyList<ReviewRatingLevelDto> RatingScale,
    ReviewAssessmentDto? SelfAssessment, ReviewAssessmentDto? ManagerAssessment,
    bool HasApprovedPlan, bool ObjectiveRatingsEnabled, IReadOnlyList<ReviewItemAssessmentDto> Items,
    int? FinalRating, string? FinalRatingSource, DateTime? FinalizedAt, ReviewCalibrationDto? Calibration = null);

/// <summary>Why a rating changed in calibration. Never projected to the review's subject.</summary>
public sealed record ReviewCalibrationDto(bool SessionFinalized, int OriginalRating, int? CalibratedRating, string? Rationale);

public static class ReviewComposer
{
    public static PerformanceReviewDto Compose(PerformanceReview review, ReviewRound round, ReviewActor actor,
        bool hasApprovedPlan, IReadOnlyList<ReviewItemAssessmentDto> items, ReviewCalibrationDto? calibration = null,
        int ratingScaleVersion = 0)
    {
        var visibility = ReviewPolicy.Visibility(actor, review, calibration?.SessionFinalized == true);
        if (!visibility.CanRead) throw new UnauthorizedAccessException("This review is not available to this user.");
        var released = review.State == PerformanceReviewState.Finalized;
        var frozen = released ? ReadFinalizedSnapshot(review.FinalizedSnapshotJson) : null;
        var scale = frozen?.RatingScale ?? (System.Text.Json.JsonSerializer.Deserialize<RatingScaleLevel[]>(review.RatingScaleSnapshotJson) ?? [])
            .Select(level => new ReviewRatingLevelDto(level.Value, level.Label, level.Description)).ToArray();
        var content = frozen?.Items ?? items;
        return new(review.Id, review.ReviewRoundId, review.CycleId, frozen?.Review.Name ?? round.Name,
            frozen?.Review.PeriodStart ?? round.PeriodStart, frozen?.Review.PeriodEnd ?? round.PeriodEnd,
            frozen?.Review.SubjectDisplayName ?? review.SubjectDisplayName, frozen?.Review.ReviewerDisplayName ?? review.ReviewerDisplayName,
            review.State, review.CurrentStageDueDate,
            review.SelfAssessmentEnabled, review.CalibrationEnabled, visibility.CanEditSelfAssessment, visibility.CanEditManagerAssessment,
            review.Version, frozen?.RatingScaleVersionId ?? review.RatingScaleVersionId,
            frozen?.RatingScaleVersion ?? ratingScaleVersion, scale,
            frozen?.SelfAssessment ?? (visibility.ShowSelfAssessment ? Assessment(review.SelfAssessment) : null),
            SubjectSafeManagerAssessment(visibility, frozen?.ManagerAssessment)
                ?? (visibility.ShowManagerAssessment ? Assessment(review.ManagerAssessment, visibility.IsSubject) : null),
            frozen?.Review.HasApprovedPlan ?? hasApprovedPlan, review.ObjectiveRatingsEnabled,
            content.Select(item => item with
            {
                SelfReflection = frozen is not null || visibility.ShowSelfAssessment ? item.SelfReflection : null,
                SelfRating = frozen is not null || visibility.ShowSelfAssessment ? item.SelfRating : null,
                SelfComment = frozen is not null || visibility.ShowSelfAssessment ? item.SelfComment : null,
                ManagerAssessment = frozen is not null || visibility.ShowManagerAssessment ? item.ManagerAssessment : null,
                ManagerRating = frozen is not null || visibility.ShowManagerAssessment ? item.ManagerRating : null,
            }).ToArray(),
            // A calibrated outcome is set before release; nobody reads it through the review until finalization.
            // The subject gets the final rating but not where it came from: that would be calibration detail.
            released ? review.FinalRating : null, released && !visibility.IsSubject ? review.FinalRatingSource : null, review.FinalizedAt,
            visibility.ShowCalibration ? calibration : null);
    }

    private static ReviewFinalizedSnapshot? ReadFinalizedSnapshot(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            using var document = System.Text.Json.JsonDocument.Parse(json);
            var legacyShape = document.RootElement.TryGetProperty("items", out var items)
                && items.ValueKind == System.Text.Json.JsonValueKind.Array
                && items.EnumerateArray().Any(item => item.TryGetProperty("measurementSummary", out _)
                    || item.TryGetProperty("evidenceSummary", out var evidence) && evidence.ValueKind == System.Text.Json.JsonValueKind.Array
                    && evidence.EnumerateArray().Any(value => value.ValueKind == System.Text.Json.JsonValueKind.String));
            if (!legacyShape) return System.Text.Json.JsonSerializer.Deserialize<ReviewFinalizedSnapshot>(json, options);
            var legacy = System.Text.Json.JsonSerializer.Deserialize<LegacyReviewFinalizedSnapshot>(json, options);
            if (legacy is null) return null;
            var converted = legacy.Items.Select(item => new ReviewItemAssessmentDto(item.Kind, item.ItemId, item.Title,
                item.Description, item.Behaviors, null, item.HasProgress, item.Progress, item.EvidenceSummary.Count,
                item.EvidenceSummary.Select(label => new ReviewEvidenceRefDto(null, null, label, null)).ToArray(),
                item.SelfReflection, item.SelfRating, item.SelfComment, item.ManagerAssessment, item.ManagerRating,
                item.MeasurementSummary)).ToArray();
            return new ReviewFinalizedSnapshot(legacy.Review, legacy.RatingScale, legacy.SelfAssessment, legacy.ManagerAssessment,
                converted, legacy.RatingScaleVersionId, legacy.RatingScaleVersion);
        }
        catch (System.Text.Json.JsonException) { return null; }
    }

    private sealed record ReviewFinalizedSnapshot(ReviewSnapshotFacts Review, IReadOnlyList<ReviewRatingLevelDto> RatingScale,
        ReviewAssessmentDto? SelfAssessment, ReviewAssessmentDto? ManagerAssessment, IReadOnlyList<ReviewItemAssessmentDto> Items,
        Guid? RatingScaleVersionId = null, int? RatingScaleVersion = null);
    private sealed record LegacyReviewFinalizedSnapshot(ReviewSnapshotFacts Review, IReadOnlyList<ReviewRatingLevelDto> RatingScale,
        ReviewAssessmentDto? SelfAssessment, ReviewAssessmentDto? ManagerAssessment, IReadOnlyList<LegacyReviewItemAssessmentDto> Items,
        Guid? RatingScaleVersionId = null, int? RatingScaleVersion = null);
    private sealed record LegacyReviewItemAssessmentDto(ReviewItemKind Kind, Guid ItemId, string Title, string? Description,
        IReadOnlyList<string> Behaviors, string? MeasurementSummary, bool HasProgress, decimal? Progress,
        IReadOnlyList<string> EvidenceSummary, string? SelfReflection, int? SelfRating, string? SelfComment,
        string? ManagerAssessment, int? ManagerRating);
    private sealed record ReviewSnapshotFacts(Guid Id, Guid CycleId, Guid ReviewRoundId, string Name, DateOnly PeriodStart,
        DateOnly PeriodEnd, Guid SubjectEmployeeId, string SubjectDisplayName, Guid ReviewerEmployeeId,
        string ReviewerDisplayName, bool SelfAssessmentEnabled, bool ObjectiveRatingsEnabled, bool HasApprovedPlan,
        string? SubjectJobTitle = null, Guid? SubjectOrgUnitId = null, string? SubjectOrgUnitName = null, string? ReviewerBasis = null);

    private static ReviewAssessmentDto Assessment(ReviewAssessment value)
        => new(value.Summary, value.OverallRating, value.SavedAt, value.SubmittedAt);

    private static ReviewAssessmentDto? SubjectSafeManagerAssessment(ReviewVisibility visibility, ReviewAssessmentDto? assessment)
        => assessment is not null && visibility.IsSubject ? assessment with { OverallRating = null } : assessment;

    private static ReviewAssessmentDto Assessment(ReviewAssessment value, bool isSubject)
        => new(value.Summary, isSubject ? null : value.OverallRating, value.SavedAt, value.SubmittedAt);
}

public sealed class GetPerformanceReviewHandler(PerformanceDbContext db)
    : IQueryHandler<GetPerformanceReviewQuery, Result<PerformanceReviewDto>>
{
    public async Task<Result<PerformanceReviewDto>> Handle(GetPerformanceReviewQuery query, CancellationToken token)
    {
        var review = await db.PerformanceReviews.AsNoTracking().FirstOrDefaultAsync(item => item.Id == query.ReviewId, token);
        if (review is null) return Result.Failure<PerformanceReviewDto>(PerformanceErrors.NotFound("PerformanceReview", query.ReviewId));
        var round = await db.ReviewRounds.AsNoTracking().FirstOrDefaultAsync(item => item.Id == review.ReviewRoundId, token);
        if (round is null) return Result.Failure<PerformanceReviewDto>(PerformanceErrors.NotFound("ReviewRound", review.ReviewRoundId));
        var ratingScaleVersion = await db.RatingScaleVersions.AsNoTracking()
            .SingleAsync(item => item.Id == review.RatingScaleVersionId, token);
        var session = await db.CalibrationSessions.AsNoTracking().FirstOrDefaultAsync(item => item.ReviewRoundId == review.ReviewRoundId, token);
        var calibrationSubject = session is null ? null : await db.CalibrationSubjects.AsNoTracking()
            .FirstOrDefaultAsync(item => item.SessionId == session.Id && item.ReviewId == review.Id, token);
        var calibration = calibrationSubject is null ? null : new ReviewCalibrationDto(session!.State == CalibrationSessionState.Finalized,
            calibrationSubject.OriginalRating, calibrationSubject.CalibratedRating, calibrationSubject.Rationale);
        // Facilitation is a seat on this round's open session with this review as a subject, plus the grant.
        var actor = query.Actor.CalibratorUserId is Guid calibrator && calibrationSubject is not null
            && session!.State == CalibrationSessionState.Open
            && CalibrationPolicy.CanView(query.Actor.CalibratorUserId is not null, session, calibrator)
            ? query.Actor with { IsCalibrationFacilitator = true } : query.Actor with { IsCalibrationFacilitator = false };
        var visibility = ReviewPolicy.Visibility(actor, review, calibration?.SessionFinalized == true);
        if (!visibility.CanRead)
            return Result.Failure<PerformanceReviewDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ReviewAssessmentForbidden,
                "You do not have a relationship to this review."));

        var plan = await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(item => item.CycleId == review.CycleId
            && item.EmployeeId == review.SubjectEmployeeId && item.State == PlanLifecycleState.Approved, token);
        var objectives = plan is null ? [] : await db.Objectives.AsNoTracking()
            .Where(item => item.EmployeePlanId == plan.Id && item.State != ObjectiveLifecycleState.Archived)
            .OrderBy(item => item.CreatedAt).ToListAsync(token);
        var objectiveIds = objectives.Select(item => item.Id).ToArray();
        var progress = objectiveIds.Length == 0 ? [] : await db.ProgressUpdates.AsNoTracking().Include(item => item.Evidence)
            .Where(item => objectiveIds.Contains(item.ObjectiveId)).OrderByDescending(item => item.RecordedAt).ToListAsync(token);
        var responses = await db.ReviewItemResponses.AsNoTracking().Where(item => item.ReviewId == review.Id).ToListAsync(token);
        var responseMap = responses.ToDictionary(item => (item.Kind, item.ItemId));
        var competencySnapshot = ReadCompetencies(round.ConfigSnapshotJson);
        var items = objectives.Select(objective =>
        {
            responseMap.TryGetValue((ReviewItemKind.Objective, objective.Id), out var response);
            var evidence = progress.Where(update => update.ObjectiveId == objective.Id).SelectMany(update =>
                update.Evidence.Select(item => new ReviewEvidenceRefDto(item.Id, item.Kind, EvidenceLabel(item), update.RecordedAt)))
                .ToArray();
            return new ReviewItemAssessmentDto(ReviewItemKind.Objective, objective.Id, objective.Title, objective.Description,
                [], PerformanceMappers.ToDtoOrNull(objective.Measurement), objective.HasProgress,
                objective.HasProgress ? decimal.Round(objective.DerivedProgress, 2) : null,
                evidence.Length, evidence.Take(12).ToArray(), response?.SelfReflection, response?.SelfRating, response?.SelfComment,
                response?.ManagerAssessment, response?.ManagerRating);
        }).Concat(competencySnapshot.Select(competency =>
        {
            responseMap.TryGetValue((ReviewItemKind.Competency, competency.Id), out var response);
            return new ReviewItemAssessmentDto(ReviewItemKind.Competency, competency.Id, competency.Name, competency.Description,
                competency.Behaviors, null, false, null, 0, [], response?.SelfReflection, response?.SelfRating,
                response?.SelfComment, response?.ManagerAssessment, response?.ManagerRating);
        })).ToArray();
        return Result.Success(ReviewComposer.Compose(review, round, actor, plan is not null, items, calibration, ratingScaleVersion.Number));
    }

    private static string EvidenceLabel(EvidenceItem item) => item.Kind switch
    {
        EvidenceKind.File => item.FileName ?? "File evidence",
        EvidenceKind.Link => item.ReferenceText ?? item.Url ?? "Linked evidence",
        _ => item.ReferenceText ?? "Evidence",
    };

    private static IReadOnlyList<CompetencySnapshot> ReadCompetencies(string? snapshot)
    {
        if (string.IsNullOrWhiteSpace(snapshot)) return [];
        try { return System.Text.Json.JsonSerializer.Deserialize<ReviewConfigSnapshot>(snapshot,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })?.Competencies ?? []; }
        catch (System.Text.Json.JsonException) { return []; }
    }

    private sealed record ReviewConfigSnapshot(IReadOnlyList<CompetencySnapshot>? Competencies);
    private sealed record CompetencySnapshot(Guid Id, string Name, string Description, IReadOnlyList<string> Behaviors);
}
