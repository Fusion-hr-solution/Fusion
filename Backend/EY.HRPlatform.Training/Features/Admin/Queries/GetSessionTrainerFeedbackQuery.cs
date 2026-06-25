using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>US-8.1.3 — admin: the trainer's group feedback for a session (null if none submitted).</summary>
public record GetSessionTrainerFeedbackQuery(Guid SessionId) : IQuery<Result<TrainerGroupFeedbackDto?>>;

public class GetSessionTrainerFeedbackQueryHandler
    : IQueryHandler<GetSessionTrainerFeedbackQuery, Result<TrainerGroupFeedbackDto?>>
{
    private readonly TrainingDbContext _db;

    public GetSessionTrainerFeedbackQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainerGroupFeedbackDto?>> Handle(
        GetSessionTrainerFeedbackQuery request, CancellationToken cancellationToken)
    {
        var feedback = await _db.TrainerGroupFeedbacks
            .AsNoTracking()
            .Where(t => t.SessionId == request.SessionId)
            .OrderByDescending(t => t.SubmittedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (feedback is null)
            return Result.Success<TrainerGroupFeedbackDto?>(null);

        var session = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.Id == request.SessionId)
            .Select(s => new { s.TrainerName, s.TrainerEmail })
            .FirstOrDefaultAsync(cancellationToken);

        var profileName = await _db.EmployeeProfiles
            .AsNoTracking()
            .Where(p => p.EmployeeId == feedback.TrainerEmployeeId)
            .Select(p => p.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        var trainerName = !string.IsNullOrWhiteSpace(profileName)
            ? profileName!
            : session?.TrainerName ?? session?.TrainerEmail ?? "Trainer";

        return Result.Success<TrainerGroupFeedbackDto?>(new TrainerGroupFeedbackDto
        {
            SessionId = feedback.SessionId,
            TrainerEmployeeId = feedback.TrainerEmployeeId,
            TrainerName = trainerName,
            GroupEngagement = feedback.GroupEngagement,
            KnowledgeLevel = feedback.KnowledgeLevel,
            Comments = feedback.Comments,
            PrerequisiteSuggestions = feedback.PrerequisiteSuggestions,
            SubmittedAt = feedback.SubmittedAt,
        });
    }
}
