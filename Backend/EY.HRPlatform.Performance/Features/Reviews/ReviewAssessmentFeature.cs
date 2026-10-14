using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Calibration;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;


namespace EY.HRPlatform.Performance.Features.Reviews;

public sealed record SaveSelfAssessmentCommand(Guid ReviewId, ReviewActor Actor, uint ExpectedVersion, string Summary, IReadOnlyList<ReviewItemResponseInput>? Items = null)
    : ICommand<Result<PerformanceReviewMutationDto>>;
public sealed record SubmitSelfAssessmentCommand(Guid ReviewId, ReviewActor Actor, uint ExpectedVersion, string Summary, IReadOnlyList<ReviewItemResponseInput>? Items = null)
    : ICommand<Result<PerformanceReviewMutationDto>>;
public sealed record SaveManagerAssessmentCommand(Guid ReviewId, ReviewActor Actor, uint ExpectedVersion, string Summary, int? OverallRating, IReadOnlyList<ReviewItemResponseInput>? Items = null)
    : ICommand<Result<PerformanceReviewMutationDto>>;
public sealed record SubmitManagerAssessmentCommand(Guid ReviewId, ReviewActor Actor, uint ExpectedVersion, string Summary, int? OverallRating, IReadOnlyList<ReviewItemResponseInput>? Items = null)
    : ICommand<Result<PerformanceReviewMutationDto>>;

public sealed record PerformanceReviewMutationDto(Guid Id, PerformanceReviewState State, DateOnly? DueDate, uint Version);

internal static class ReviewAssessmentCommands
{
    public static async Task<PerformanceReview?> LoadAsync(PerformanceDbContext db, Guid id, CancellationToken token)
        => await db.PerformanceReviews.Include(review => review.ItemResponses).FirstOrDefaultAsync(review => review.Id == id, token);

    public static PerformanceReviewMutationDto ToDto(PerformanceReview review)
        => new(review.Id, review.State, review.CurrentStageDueDate, review.Version);

    public static async Task<Result<PerformanceReviewMutationDto>> SaveAsync(
        PerformanceDbContext db, PerformanceReview review, uint expectedVersion, string summary, int? rating,
        IReadOnlyList<ReviewItemResponseInput>? items, ReviewActor actor, bool self, IPerformanceAudit audit, CancellationToken token)
    {
        if (!(self ? ReviewPolicy.CanSelfAssess(actor, review) : ReviewPolicy.CanManagerAssess(actor, review)))
            return Forbidden();
        if (VersionGuard.Check(review, expectedVersion) is { } stale) return Result.Failure<PerformanceReviewMutationDto>(stale);
        try
        {
            var itemError = await ApplyItemsAsync(db, review, items, self, requireComplete: false, token);
            if (itemError is not null) return Result.Failure<PerformanceReviewMutationDto>(itemError);
            if (self) review.SaveSelfAssessment(actor.EmployeeId, summary, DateTime.UtcNow);
            else review.SaveManagerAssessment(actor.EmployeeId, summary, rating, DateTime.UtcNow);
            audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId,
                self ? PerformanceAuditActions.ReviewSelfAssessmentSaved : PerformanceAuditActions.ReviewManagerAssessmentSaved,
                new { before = new { state = review.State.ToString() }, after = new { state = review.State.ToString(), summaryLength = summary?.Length ?? 0, overallRating = self ? null : rating } });
            await db.SaveChangesAsync(token);
            return Result.Success(ToDto(review));
        }
        catch (ArgumentException ex) { return Invalid(ex.Message); }
        catch (InvalidOperationException ex) { return InvalidState(ex.Message); }
        catch (UnauthorizedAccessException) { return Forbidden(); }
    }

    public static async Task<Result<PerformanceReviewMutationDto>> SubmitAsync(
        PerformanceDbContext db, PerformanceReview review, uint expectedVersion, string summary, int? rating,
        IReadOnlyList<ReviewItemResponseInput>? items, ReviewActor actor, bool self, IPerformanceAudit audit, IPerformanceNotifications notifications, CancellationToken token)
    {
        var alreadySubmitted = self ? review.SelfAssessment.IsSubmitted : review.ManagerAssessment.IsSubmitted;
        var authorized = self
            ? ReviewPolicy.CanSelfAssess(actor, review, allowSubmittedRetry: alreadySubmitted)
            : ReviewPolicy.CanManagerAssess(actor, review, allowSubmittedRetry: alreadySubmitted);
        if (!authorized) return Forbidden();
        if (!alreadySubmitted && VersionGuard.Check(review, expectedVersion) is { } stale)
            return Result.Failure<PerformanceReviewMutationDto>(stale);
        try
        {
            var itemError = await ApplyItemsAsync(db, review, items, self, requireComplete: true, token);
            if (itemError is not null) return Result.Failure<PerformanceReviewMutationDto>(itemError);
            var changed = self
                ? review.SubmitSelfAssessment(actor.EmployeeId, summary, DateTime.UtcNow)
                : review.SubmitManagerAssessment(actor.EmployeeId, summary, rating, DateTime.UtcNow);
            if (!changed) return Result.Success(ToDto(review));
            audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId,
                self ? PerformanceAuditActions.ReviewSelfAssessmentSubmitted : PerformanceAuditActions.ReviewManagerAssessmentSubmitted,
                new { before = new { state = self ? PerformanceReviewState.SelfAssessment.ToString() : PerformanceReviewState.ManagerAssessment.ToString() }, after = new { state = review.State.ToString(), overallRating = self ? null : rating } });
            if (self)
            {
                var round = await db.ReviewRounds.AsNoTracking().SingleAsync(item => item.Id == review.ReviewRoundId, token);
                notifications.EnqueueReview(review, PerformanceNotificationKind.SelfAssessmentSubmitted, round.Name);
            }
            else if (review.State == PerformanceReviewState.Calibration)
                await CalibrationSessions.JoinAsync(db, review, notifications, token);
            await db.SaveChangesAsync(token);
            if (review.State == PerformanceReviewState.Calibration)
                await CalibrationSessions.ConfirmReadyAfterCommitAsync(db, review.ReviewRoundId, notifications, token);
            return Result.Success(ToDto(review));
        }
        catch (ArgumentException ex) { return Invalid(ex.Message); }
        catch (InvalidOperationException ex) { return InvalidState(ex.Message); }
        catch (UnauthorizedAccessException) { return Forbidden(); }
    }

    private static Result<PerformanceReviewMutationDto> Forbidden()
        => Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.ReviewAssessmentForbidden,
            "You do not have authority to assess this review."));

    private static Result<PerformanceReviewMutationDto> Invalid(string message)
        => Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid, message));
    private static Result<PerformanceReviewMutationDto> InvalidState(string message)
        => Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewAssessmentInvalid, message));

    private static async Task<EY.HRPlatform.SharedKernel.Results.Error?> ApplyItemsAsync(PerformanceDbContext db,
        PerformanceReview review, IReadOnlyList<ReviewItemResponseInput>? inputs, bool self, bool requireComplete, CancellationToken token)
    {
        inputs ??= [];
        if (inputs.Select(item => (item.Kind, item.ItemId)).Distinct().Count() != inputs.Count)
            return PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid, "Each review item can be submitted only once.");

        var competencyIds = new HashSet<Guid>();
        var round = await db.ReviewRounds.AsNoTracking().SingleAsync(item => item.Id == review.ReviewRoundId, token);
        if (!string.IsNullOrWhiteSpace(round.ConfigSnapshotJson))
        {
            try
            {
                using var snapshot = System.Text.Json.JsonDocument.Parse(round.ConfigSnapshotJson);
                if (snapshot.RootElement.TryGetProperty("competencies", out var values))
                    foreach (var competency in values.EnumerateArray())
                        if (competency.TryGetProperty("id", out var id) && id.TryGetGuid(out var value)) competencyIds.Add(value);
            }
            catch (System.Text.Json.JsonException) { }
        }
        var plan = await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(item => item.CycleId == review.CycleId
            && item.EmployeeId == review.SubjectEmployeeId && item.State == PlanLifecycleState.Approved, token);
        var objectiveIds = plan is null ? new HashSet<Guid>() : (await db.Objectives.AsNoTracking()
            .Where(item => item.EmployeePlanId == plan.Id && item.State != ObjectiveLifecycleState.Archived)
            .Select(item => item.Id).ToListAsync(token)).ToHashSet();
        var expected = competencyIds.Select(id => (ReviewItemKind.Competency, id))
            .Concat(objectiveIds.Select(id => (ReviewItemKind.Objective, id))).ToHashSet();
        if (inputs.Any(item => !expected.Contains((item.Kind, item.ItemId))))
            return PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid, "An assessment contains an item that is not part of this review.");
        var levels = System.Text.Json.JsonSerializer.Deserialize<RatingScaleLevel[]>(review.RatingScaleSnapshotJson) ?? [];
        if (inputs.Any(item => item.Rating is int value && !levels.Any(level => level.Value == value)))
            return PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid, "Every item rating must be a level on this review's snapshotted scale.");

        if (requireComplete)
        {
            var missing = expected.Where(key =>
            {
                var input = inputs.FirstOrDefault(item => item.Kind == key.Item1 && item.ItemId == key.Item2);
                if (input is null) return true;
                var ratingRequired = key.Item1 == ReviewItemKind.Competency || review.ObjectiveRatingsEnabled;
                return ratingRequired && input.Rating is null;
            }).ToArray();
            if (missing.Length > 0)
                return PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewAssessmentInvalid,
                    $"Complete every required item rating before submitting. Missing {missing.Length} rating(s).");
        }

        foreach (var key in expected)
            if (!review.ItemResponses.Any(item => item.Kind == key.Item1 && item.ItemId == key.Item2))
            {
                var response = ReviewItemResponse.Create(review.TenantId, review.Id, key.Item1, key.Item2);
                review.AddItemResponse(response);
                db.ReviewItemResponses.Add(response);
            }
        foreach (var input in inputs)
        {
            var response = review.ItemResponses.Single(item => item.Kind == input.Kind && item.ItemId == input.ItemId);
            if (self) response.SaveSelf(input.Reflection, input.Rating, input.Comment);
            else response.SaveManager(input.Assessment, input.Rating);
        }
        return null;
    }
}

public sealed class SaveSelfAssessmentHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<SaveSelfAssessmentCommand, Result<PerformanceReviewMutationDto>>
{
    public async Task<Result<PerformanceReviewMutationDto>> Handle(SaveSelfAssessmentCommand command, CancellationToken token)
    {
        var review = await ReviewAssessmentCommands.LoadAsync(db, command.ReviewId, token);
        if (review is null) return Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        return await ReviewAssessmentCommands.SaveAsync(db, review, command.ExpectedVersion, command.Summary, null, command.Items,
            command.Actor, true, audit, token);
    }
}

public sealed class SubmitSelfAssessmentHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<SubmitSelfAssessmentCommand, Result<PerformanceReviewMutationDto>>
{
    public async Task<Result<PerformanceReviewMutationDto>> Handle(SubmitSelfAssessmentCommand command, CancellationToken token)
    {
        var review = await ReviewAssessmentCommands.LoadAsync(db, command.ReviewId, token);
        if (review is null) return Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        return await ReviewAssessmentCommands.SubmitAsync(db, review, command.ExpectedVersion, command.Summary, null, command.Items,
            command.Actor, true, audit, notifications, token);
    }
}

public sealed class SaveManagerAssessmentHandler(PerformanceDbContext db, IPerformanceAudit audit)
    : ICommandHandler<SaveManagerAssessmentCommand, Result<PerformanceReviewMutationDto>>
{
    public async Task<Result<PerformanceReviewMutationDto>> Handle(SaveManagerAssessmentCommand command, CancellationToken token)
    {
        var review = await ReviewAssessmentCommands.LoadAsync(db, command.ReviewId, token);
        if (review is null) return Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        return await ReviewAssessmentCommands.SaveAsync(db, review, command.ExpectedVersion, command.Summary, command.OverallRating, command.Items,
            command.Actor, false, audit, token);
    }
}

public sealed class SubmitManagerAssessmentHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<SubmitManagerAssessmentCommand, Result<PerformanceReviewMutationDto>>
{
    public async Task<Result<PerformanceReviewMutationDto>> Handle(SubmitManagerAssessmentCommand command, CancellationToken token)
    {
        var review = await ReviewAssessmentCommands.LoadAsync(db, command.ReviewId, token);
        if (review is null) return Result.Failure<PerformanceReviewMutationDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        return await ReviewAssessmentCommands.SubmitAsync(db, review, command.ExpectedVersion, command.Summary, command.OverallRating, command.Items,
            command.Actor, false, audit, notifications, token);
}
}
