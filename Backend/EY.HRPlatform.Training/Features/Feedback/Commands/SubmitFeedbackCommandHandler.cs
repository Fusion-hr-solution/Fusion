using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

public class SubmitFeedbackCommandHandler : ICommandHandler<SubmitFeedbackCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public SubmitFeedbackCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(SubmitFeedbackCommand request, CancellationToken cancellationToken)
    {
        if (!IsValidRating(request.OverallRating)
            || !IsValidRating(request.ContentRating)
            || !IsValidRating(request.RelevanceRating)
            || (request.TrainerRating is { } tr && !IsValidRating(tr)))
        {
            return Result.Failure<Guid>(Error.Validation(
                "Feedback.InvalidRating", "Ratings must be between 1 and 5."));
        }

        // Training must exist (soft-deleted trainings are excluded by the global query filter).
        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        // The learner must have completed the training (ADR 0005 unifies e-learning and on-site
        // completion under TrainingProgress.Completed).
        var hasCompleted = await _db.TrainingProgress
            .AnyAsync(p => p.EmployeeId == request.EmployeeId
                && p.TrainingId == request.TrainingId
                && p.Status == TrainingStatus.Completed,
                cancellationToken);

        if (!hasCompleted)
            return Result.Failure<Guid>(Error.Validation(
                "Feedback.NotCompleted", "You can only give feedback on a training you have completed."));

        // One feedback per (employee, training); immutable — re-submission is a conflict.
        var alreadySubmitted = await _db.TrainingFeedbacks
            .AnyAsync(f => f.EmployeeId == request.EmployeeId
                && f.TrainingId == request.TrainingId,
                cancellationToken);

        if (alreadySubmitted)
            return Result.Failure<Guid>(Error.Conflict(
                "Feedback.AlreadySubmitted", "You have already submitted feedback for this training."));

        var feedback = new TrainingFeedback(
            request.EmployeeId,
            request.TrainingId,
            request.OverallRating,
            request.ContentRating,
            request.RelevanceRating,
            request.WouldRecommend,
            request.TrainerRating,
            request.Comment,
            request.Suggestions,
            request.IsAnonymous);

        _db.TrainingFeedbacks.Add(feedback);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(feedback.Id);
    }

    private static bool IsValidRating(int rating) => rating is >= 1 and <= 5;
}
