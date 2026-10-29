using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Reviews;

/// <summary>HR who moved the date, recorded with the move so the round activity can name them.</summary>
public sealed record ScheduleActor(Guid? EmployeeId, string Name);

public sealed record MoveRoundDueDateCommand(Guid RoundId, MoveRoundDueDateRequest Request, ScheduleActor Actor) : ICommand<Result<ReviewDueDateMoveDto>>;
public sealed record MoveReviewDueDateCommand(Guid ReviewId, MoveReviewDueDateRequest Request, ScheduleActor Actor) : ICommand<Result<ReviewDueDateMoveDto>>;

internal static class ReviewSchedule
{
    public static ReviewDueDateMoveDto ToDto(ReviewDueDateMove move)
        => new(move.Id, move.Stage, move.FromDate, move.ToDate, move.Reason, move.ActorName, move.MovedAt, move.AffectedCount,
            move.ReviewId, move.SubjectDisplayName);

    /// <summary>The catalogue key naming the moved task from the recipient's side: their own task, or the other person's.</summary>
    public static string MovedTitleKey(PerformanceReview review, ReviewStage stage, Guid recipient)
    {
        var owner = stage switch
        {
            ReviewStage.SelfAssessment => review.SubjectEmployeeId,
            ReviewStage.ManagerAssessment => review.ReviewerEmployeeId,
            _ => recipient,
        };
        if (recipient == owner)
            return stage switch
            {
                ReviewStage.SelfAssessment => "ReviewDueDateMoved.own.selfAssessment",
                ReviewStage.PeerInput => "ReviewDueDateMoved.own.peerInput",
                _ => "ReviewDueDateMoved.own.managerAssessment",
            };
        return stage == ReviewStage.SelfAssessment ? "ReviewDueDateMoved.subjectSelf" : "ReviewDueDateMoved.reviewerAssessment";
    }

    public static void Notify(IPerformanceNotifications notifications, PerformanceReview review, ReviewRound round, ReviewDueDateMove move,
        Guid recipient, string resourceType, Guid resourceId, string href)
    {
        var title = MovedTitleKey(review, move.Stage, recipient);
        var payload = new ReviewWorkNotificationPayload(review.CycleId, round.Id, review.Id, round.Name, href,
            move.ActorName, review.SubjectDisplayName, title, move.ToDate, PreviousDueDate: move.FromDate);
        notifications.EnqueueReviewWork(review, PerformanceNotificationKind.ReviewDueDateMoved, recipient, resourceType, resourceId,
            $"{PerformanceNotificationKind.ReviewDueDateMoved}:{move.Id:N}:{resourceId:N}:{recipient:N}", payload,
            PerformanceNotificationTemplates.ForDueDateMoved(title, review, move.ToDate, move.FromDate, round.Name, href));
    }
}

/// <summary>
/// Moves one stage's date for the whole running round (D-02): every open review of that stage follows unless HR gave
/// it its own date; peer requests follow the peer date. People whose open task moved are told.
/// </summary>
public sealed class MoveRoundDueDateHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<MoveRoundDueDateCommand, Result<ReviewDueDateMoveDto>>
{
    public async Task<Result<ReviewDueDateMoveDto>> Handle(MoveRoundDueDateCommand command, CancellationToken token)
    {
        var round = await db.ReviewRounds.FirstOrDefaultAsync(r => r.Id == command.RoundId, token);
        if (round is null) return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.NotFound("ReviewRound", command.RoundId));
        if (round.State != ReviewRoundState.Active)
            return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewRoundNotActive,
                "Due dates move only while the round runs."));
        if (VersionGuard.Check(round, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewDueDateMoveDto>(stale);
        var cycle = await db.Cycles.SingleAsync(c => c.Id == round.CycleId, token);
        var request = command.Request;
        DateOnly? from;
        try
        {
            ReviewDueDateMove.NormalizeReason(request.Reason);
            from = round.MoveDueDate(cycle, request.Stage, request.DueDate);
        }
        catch (ArgumentException ex) { return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewDueDateInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewRoundNotActive, ex.Message)); }

        var now = PerformanceClock.UtcNow;
        var reviews = await db.PerformanceReviews.Where(r => r.ReviewRoundId == round.Id
            && r.State != PerformanceReviewState.Finalized && r.State != PerformanceReviewState.Closed).ToListAsync(token);
        var told = new List<(PerformanceReview Review, Guid Recipient, string Type, Guid Resource, string Href)>();
        var affected = 0;
        if (request.Stage == ReviewStage.PeerInput)
        {
            var byId = reviews.ToDictionary(r => r.Id);
            foreach (var peer in await db.PeerRequests.Where(r => r.ReviewRoundId == round.Id && r.State == PeerRequestState.Open).ToListAsync(token))
                if (byId.TryGetValue(peer.ReviewId, out var review) && peer.MoveDueDate(request.DueDate))
                {
                    affected++;
                    told.Add((review, peer.PeerEmployeeId, "PeerRequest", peer.Id, PerformanceNotificationTemplates.PeerRequestPath(peer.Id)));
                }
        }
        else
        {
            foreach (var review in reviews)
            {
                var hadTask = review.State == (request.Stage == ReviewStage.SelfAssessment
                    ? PerformanceReviewState.SelfAssessment : PerformanceReviewState.ManagerAssessment);
                var before = request.Stage == ReviewStage.SelfAssessment ? review.SelfAssessmentDueDate : review.ManagerAssessmentDueDate;
                var openTaskMoved = review.ApplyRoundDueDateMove(request.Stage, request.DueDate);
                var after = request.Stage == ReviewStage.SelfAssessment ? review.SelfAssessmentDueDate : review.ManagerAssessmentDueDate;
                if (before != after) affected++;
                if (openTaskMoved && hadTask)
                    told.Add((review, request.Stage == ReviewStage.SelfAssessment ? review.SubjectEmployeeId : review.ReviewerEmployeeId,
                        "PerformanceReview", review.Id, PerformanceNotificationTemplates.ReviewPath(review.Id)));
            }
        }
        var move = ReviewDueDateMove.Create(round, null, request.Stage, from, request.DueDate, request.Reason,
            command.Actor.EmployeeId, command.Actor.Name, now, affected);
        db.ReviewDueDateMoves.Add(move);
        foreach (var (review, recipient, type, resource, href) in told)
            ReviewSchedule.Notify(notifications, review, round, move, recipient, type, resource, href);
        audit.Record(round.TenantId, "ReviewRound", round.Id, round.CycleId, PerformanceAuditActions.ReviewRoundDueDateMoved,
            new { stage = request.Stage.ToString(), from, to = request.DueDate, reason = move.Reason, affected });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewSchedule.ToDto(move));
    }
}

/// <summary>Moves one open review's current task (D-02). The review keeps its own date through later round-level moves.</summary>
public sealed class MoveReviewDueDateHandler(PerformanceDbContext db, IPerformanceAudit audit, IPerformanceNotifications notifications)
    : ICommandHandler<MoveReviewDueDateCommand, Result<ReviewDueDateMoveDto>>
{
    public async Task<Result<ReviewDueDateMoveDto>> Handle(MoveReviewDueDateCommand command, CancellationToken token)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(r => r.Id == command.ReviewId, token);
        if (review is null) return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.NotFound("PerformanceReview", command.ReviewId));
        var round = await db.ReviewRounds.SingleAsync(r => r.Id == review.ReviewRoundId, token);
        if (round.State != ReviewRoundState.Active)
            return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewRoundNotActive,
                "Due dates move only while the round runs."));
        if (VersionGuard.Check(review, command.Request.ExpectedVersion) is { } stale) return Result.Failure<ReviewDueDateMoveDto>(stale);
        var cycle = await db.Cycles.SingleAsync(c => c.Id == round.CycleId, token);
        ReviewStage stage;
        DateOnly? from;
        try
        {
            ReviewDueDateMove.NormalizeReason(command.Request.Reason);
            round.ValidateMove(cycle, command.Request.DueDate);
            (stage, from) = review.MoveCurrentDueDate(command.Request.DueDate);
        }
        catch (ArgumentException ex) { return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.ReviewDueDateInvalid, ex.Message)); }
        catch (InvalidOperationException ex) { return Result.Failure<ReviewDueDateMoveDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.ReviewNotOpen, ex.Message)); }

        var move = ReviewDueDateMove.Create(round, review, stage, from, command.Request.DueDate, command.Request.Reason,
            command.Actor.EmployeeId, command.Actor.Name, PerformanceClock.UtcNow, 1);
        db.ReviewDueDateMoves.Add(move);
        var href = PerformanceNotificationTemplates.ReviewPath(review.Id);
        // The person and their reviewer both hear about it, whichever of them owns the task.
        ReviewSchedule.Notify(notifications, review, round, move, review.SubjectEmployeeId, "PerformanceReview", review.Id, href);
        ReviewSchedule.Notify(notifications, review, round, move, review.ReviewerEmployeeId, "PerformanceReview", review.Id, href);
        audit.Record(review.TenantId, "PerformanceReview", review.Id, review.CycleId, PerformanceAuditActions.ReviewDueDateMoved,
            new { roundId = round.Id, stage = stage.ToString(), from, to = command.Request.DueDate, reason = move.Reason });
        await db.SaveChangesAsync(token);
        return Result.Success(ReviewSchedule.ToDto(move));
    }
}
