using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>
/// US-8.1.3 — a trainer submits feedback about the group they led. Authorised in-handler by
/// matching the session's TrainerEmployeeId to the current user (no Trainer role exists).
/// One per (session, trainer).
/// </summary>
public record SubmitTrainerGroupFeedbackCommand(
    Guid TrainerEmployeeId,
    Guid SessionId,
    int GroupEngagement,
    int KnowledgeLevel,
    string? Comments,
    string? PrerequisiteSuggestions) : ICommand<Result<Guid>>;

public class SubmitTrainerGroupFeedbackCommandHandler
    : ICommandHandler<SubmitTrainerGroupFeedbackCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public SubmitTrainerGroupFeedbackCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(SubmitTrainerGroupFeedbackCommand request, CancellationToken cancellationToken)
    {
        if (request.GroupEngagement is < 1 or > 5 || request.KnowledgeLevel is < 1 or > 5)
            return Result.Failure<Guid>(Error.Validation("TrainerFeedback.InvalidRating", "Ratings must be between 1 and 5."));

        var session = await _db.TrainingSessions
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null)
            return Result.Failure<Guid>(Error.NotFound("TrainingSession", request.SessionId));

        // Authorisation: only the session's trainer may submit.
        if (session.TrainerEmployeeId != request.TrainerEmployeeId)
            return Result.Failure<Guid>(Error.Validation(
                "TrainerFeedback.NotTrainer", "You are not the trainer for this session."));

        // Precondition: feedback is only meaningful once the session has actually been held.
        // Mirrors the "Completed" effective status surfaced by GetMyTrainerSessionsQuery and
        // blocks direct POSTs for future, in-progress, or cancelled sessions.
        var hasBeenHeld = session.Status != SessionStatus.Cancelled
            && (session.Status == SessionStatus.Completed || DateTime.UtcNow >= session.EndUtc);
        if (!hasBeenHeld)
            return Result.Failure<Guid>(Error.Validation(
                "TrainerFeedback.SessionNotHeld", "You can submit feedback only after the session has been held."));

        var alreadySubmitted = await _db.TrainerGroupFeedbacks
            .AnyAsync(t => t.SessionId == request.SessionId && t.TrainerEmployeeId == request.TrainerEmployeeId, cancellationToken);

        if (alreadySubmitted)
            return Result.Failure<Guid>(Error.Conflict(
                "TrainerFeedback.AlreadySubmitted", "You have already submitted feedback for this session."));

        var feedback = new TrainerGroupFeedback(
            request.SessionId,
            request.TrainerEmployeeId,
            request.GroupEngagement,
            request.KnowledgeLevel,
            request.Comments,
            request.PrerequisiteSuggestions);

        _db.TrainerGroupFeedbacks.Add(feedback);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(feedback.Id);
    }
}
