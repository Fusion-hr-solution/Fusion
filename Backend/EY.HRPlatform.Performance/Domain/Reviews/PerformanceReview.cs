using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Domain.Population;
using System.Text.Json;

namespace EY.HRPlatform.Performance.Domain.Reviews;

/// <summary>One employee's formal review, created atomically with its round launch.</summary>
public sealed class PerformanceReview : PerformanceAggregate
{
    private PerformanceReview() { }
    private readonly List<ReviewItemResponse> _itemResponses = [];

    public Guid ReviewRoundId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid SubjectEmployeeId { get; private set; }
    public string SubjectDisplayName { get; private set; } = string.Empty;
    public string? SubjectJobTitle { get; private set; }
    public Guid? SubjectOrgUnitId { get; private set; }
    public string? SubjectOrgUnitName { get; private set; }
    public Guid ReviewerEmployeeId { get; private set; }
    public string ReviewerDisplayName { get; private set; } = string.Empty;
    public ReviewerBasis ReviewerBasis { get; private set; }
    public Guid RatingScaleVersionId { get; private set; }
    public string RatingScaleSnapshotJson { get; private set; } = "[]";
    public PerformanceReviewState State { get; private set; }
    public DateOnly? CurrentStageDueDate { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public bool SelfAssessmentEnabled { get; private set; }
    public bool ObjectiveRatingsEnabled { get; private set; }
    public bool CalibrationEnabled { get; private set; }
    public DateOnly? ManagerAssessmentDueDate { get; private set; }
    public ReviewAssessment SelfAssessment { get; private set; } = new();
    public ReviewAssessment ManagerAssessment { get; private set; } = new();
    public string? FinalizedSnapshotJson { get; private set; }
    public DateTime? FinalizedAt { get; private set; }
    public int? FinalRating { get; private set; }
    public string? FinalRatingSource { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public string? CloseReason { get; private set; }
    public IReadOnlyList<ReviewItemResponse> ItemResponses => _itemResponses;

    public void AddItemResponse(ReviewItemResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (response.ReviewId != Id || response.TenantId != TenantId)
            throw new ArgumentException("The item response must belong to this review.", nameof(response));
        if (_itemResponses.Any(item => item.Kind == response.Kind && item.ItemId == response.ItemId))
            throw new ArgumentException("A review item response already exists for this item.", nameof(response));
        _itemResponses.Add(response);
    }

    public static PerformanceReview Open(Guid tenantId, ReviewRound round, ReviewRoundSubject subject,
        Guid ratingScaleVersionId, string ratingScaleSnapshotJson, DateTime openedAt)
        => Open(tenantId, round, subject, ratingScaleVersionId, ratingScaleSnapshotJson,
            subject.SubjectDisplayName, null, null, null, subject.ReviewerDisplayName ?? string.Empty,
            subject.ReviewerBasis, openedAt);

    public static PerformanceReview Open(Guid tenantId, ReviewRound round, ReviewRoundSubject subject,
        Guid ratingScaleVersionId, string ratingScaleSnapshotJson, string subjectDisplayName, string? subjectJobTitle,
        Guid? subjectOrgUnitId, string? subjectOrgUnitName, string reviewerDisplayName, ReviewerBasis reviewerBasis, DateTime openedAt)
    {
        if (round.State != ReviewRoundState.Draft) throw new InvalidOperationException("A review can only be created from a Draft round being launched.");
        if (subject.ReviewRoundId != round.Id || subject.IsExcluded)
            throw new ArgumentException("Only an included subject of this round can be reviewed.", nameof(subject));
        if (subject.ReviewerEmployeeId is not Guid reviewerId || reviewerId == Guid.Empty)
            throw new ArgumentException("A review requires a recorded reviewer.", nameof(subject));
        return new PerformanceReview
        {
            TenantId = tenantId,
            ReviewRoundId = round.Id,
            CycleId = round.CycleId,
            SubjectEmployeeId = subject.SubjectEmployeeId,
            SubjectDisplayName = subjectDisplayName,
            SubjectJobTitle = subjectJobTitle,
            SubjectOrgUnitId = subjectOrgUnitId,
            SubjectOrgUnitName = subjectOrgUnitName,
            ReviewerEmployeeId = reviewerId,
            ReviewerDisplayName = reviewerDisplayName,
            ReviewerBasis = reviewerBasis,
            RatingScaleVersionId = ratingScaleVersionId,
            RatingScaleSnapshotJson = ratingScaleSnapshotJson,
            State = round.SelfAssessmentEnabled ? PerformanceReviewState.SelfAssessment : PerformanceReviewState.ManagerAssessment,
            CurrentStageDueDate = round.SelfAssessmentEnabled ? round.SelfAssessmentDueDate : round.ManagerAssessmentDueDate,
            SelfAssessmentEnabled = round.SelfAssessmentEnabled,
            ObjectiveRatingsEnabled = round.ObjectiveRatingsEnabled,
            CalibrationEnabled = round.CalibrationEnabled,
            ManagerAssessmentDueDate = round.ManagerAssessmentDueDate,
            SelfAssessment = new ReviewAssessment(),
            ManagerAssessment = new ReviewAssessment(),
            OpenedAt = openedAt,
        };
    }

    public bool SaveSelfAssessment(Guid actorEmployeeId, string summary, DateTime savedAt)
    {
        RequireActor(actorEmployeeId, SubjectEmployeeId, "Only the subject can save a self-assessment.");
        if (!SelfAssessmentEnabled || State != PerformanceReviewState.SelfAssessment || SelfAssessment.IsSubmitted)
            throw new InvalidOperationException("The self-assessment is not editable at this stage.");
        SelfAssessment.Save(summary, null, savedAt);
        MarkUpdated();
        return true;
    }

    public bool SubmitSelfAssessment(Guid actorEmployeeId, string summary, DateTime submittedAt)
    {
        RequireActor(actorEmployeeId, SubjectEmployeeId, "Only the subject can submit a self-assessment.");
        if (SelfAssessment.IsSubmitted)
            return SelfAssessment.Summary == NormalizeSummary(summary) ? false : throw new InvalidOperationException("A submitted self-assessment is locked.");
        if (!SelfAssessmentEnabled || State != PerformanceReviewState.SelfAssessment)
            throw new InvalidOperationException("The self-assessment cannot be submitted at this stage.");
        SelfAssessment.Submit(summary, null, submittedAt);
        State = PerformanceReviewState.ManagerAssessment;
        CurrentStageDueDate = ManagerAssessmentDueDate;
        MarkUpdated();
        return true;
    }

    public bool SaveManagerAssessment(Guid actorEmployeeId, string summary, int? overallRating, DateTime savedAt)
    {
        RequireActor(actorEmployeeId, ReviewerEmployeeId, "Only the reviewer of record can save a manager assessment.");
        if (State != PerformanceReviewState.ManagerAssessment || ManagerAssessment.IsSubmitted)
            throw new InvalidOperationException("The manager assessment is not editable at this stage.");
        ValidateRating(overallRating, required: false);
        ManagerAssessment.Save(summary, overallRating, savedAt);
        MarkUpdated();
        return true;
    }

    public bool SubmitManagerAssessment(Guid actorEmployeeId, string summary, int? overallRating, DateTime submittedAt)
    {
        RequireActor(actorEmployeeId, ReviewerEmployeeId, "Only the reviewer of record can submit a manager assessment.");
        if (ManagerAssessment.IsSubmitted)
            return ManagerAssessment.Summary == NormalizeSummary(summary) && ManagerAssessment.OverallRating == overallRating
                ? false : throw new InvalidOperationException("A submitted manager assessment is locked.");
        if (State != PerformanceReviewState.ManagerAssessment)
            throw new InvalidOperationException("The manager assessment cannot be submitted at this stage.");
        ValidateRating(overallRating, required: true);
        ManagerAssessment.Submit(summary, overallRating, submittedAt);
        State = CalibrationEnabled ? PerformanceReviewState.Calibration : PerformanceReviewState.ReadyToFinalize;
        CurrentStageDueDate = null;
        MarkUpdated();
        return true;
    }

    /// <summary>
    /// Calibration finalization sets the outcome: the calibrated rating when one exists,
    /// otherwise the manager's. The result stays unreleased until the review is finalized.
    /// </summary>
    public bool CompleteCalibration(int finalRating, bool calibrated)
    {
        if (State == PerformanceReviewState.ReadyToFinalize && FinalRating == finalRating) return false;
        if (State != PerformanceReviewState.Calibration)
            throw new InvalidOperationException("Only a review in calibration can take a calibrated outcome.");
        ValidateRating(finalRating, required: true);
        FinalRating = finalRating;
        FinalRatingSource = calibrated ? FinalRatingSources.Calibration : FinalRatingSources.Manager;
        State = PerformanceReviewState.ReadyToFinalize;
        MarkUpdated();
        return true;
    }

    public bool Finalize(string snapshotJson, int finalRating, string ratingSource, DateTime finalizedAt)
    {
        if (State == PerformanceReviewState.Finalized) return false;
        if (State != PerformanceReviewState.ReadyToFinalize)
            throw new InvalidOperationException("Only a review ready for finalization can be finalized.");
        if (SelfAssessmentEnabled && !SelfAssessment.IsSubmitted)
            throw new InvalidOperationException("A submitted self-assessment is required before finalization.");
        if (string.IsNullOrWhiteSpace(snapshotJson)) throw new ArgumentException("A final review snapshot is required.", nameof(snapshotJson));
        if (finalRating <= 0) throw new ArgumentOutOfRangeException(nameof(finalRating));
        ValidateRating(finalRating, required: true);
        if (string.IsNullOrWhiteSpace(ratingSource)) throw new ArgumentException("A final rating source is required.", nameof(ratingSource));
        FinalizedSnapshotJson = snapshotJson;
        FinalRating = finalRating;
        FinalRatingSource = ratingSource;
        FinalizedAt = finalizedAt;
        State = PerformanceReviewState.Finalized;
        CurrentStageDueDate = null;
        MarkUpdated();
        return true;
    }

    public bool CloseAdministratively(string reason, DateTime closedAt)
    {
        if (State == PerformanceReviewState.Closed) return false;
        if (State == PerformanceReviewState.Finalized)
            throw new InvalidOperationException("A finalized review cannot be closed administratively.");
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 1000)
            throw new ArgumentException("A close reason between 1 and 1,000 characters is required.", nameof(reason));
        CloseReason = reason.Trim();
        ClosedAt = closedAt;
        State = PerformanceReviewState.Closed;
        CurrentStageDueDate = null;
        MarkUpdated();
        return true;
    }

    private void ValidateRating(int? rating, bool required)
    {
        if (rating is null)
        {
            if (required) throw new ArgumentException("An overall rating is required.", nameof(rating));
            return;
        }
        var levels = JsonSerializer.Deserialize<RatingScaleLevel[]>(RatingScaleSnapshotJson) ?? [];
        if (!levels.Any(level => level.Value == rating.Value))
            throw new ArgumentException("The overall rating must be a level on this review's snapshotted scale.", nameof(rating));
    }

    internal static string NormalizeSummary(string summary)
    {
        if (string.IsNullOrWhiteSpace(summary)) throw new ArgumentException("A summary is required.", nameof(summary));
        var normalized = summary.Trim();
        if (normalized.Length > 4000) throw new ArgumentException("A summary cannot exceed 4,000 characters.", nameof(summary));
        return normalized;
    }

    private static void RequireActor(Guid actorId, Guid ownerId, string message)
    {
        if (actorId == Guid.Empty || actorId != ownerId) throw new UnauthorizedAccessException(message);
    }
}

public static class FinalRatingSources
{
    public const string Manager = "Manager";
    public const string Calibration = "Calibration";
}

public sealed class ReviewAssessment
{
    public string Summary { get; private set; } = string.Empty;
    public int? OverallRating { get; private set; }
    public DateTime? SavedAt { get; private set; }
    public DateTime? SubmittedAt { get; private set; }
    public bool IsSubmitted => SubmittedAt is not null;

    internal ReviewAssessment() { }
    internal void Save(string summary, int? overallRating, DateTime savedAt)
    {
        Summary = PerformanceReview.NormalizeSummary(summary);
        OverallRating = overallRating;
        SavedAt = savedAt;
    }
    internal void Submit(string summary, int? overallRating, DateTime submittedAt)
    {
        Save(summary, overallRating, submittedAt);
        SubmittedAt = submittedAt;
    }
}
