using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Feedback.Queries;

public class GetMyPendingFeedbackQueryHandler
    : IQueryHandler<GetMyPendingFeedbackQuery, Result<List<PendingFeedbackDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyPendingFeedbackQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<PendingFeedbackDto>>> Handle(
        GetMyPendingFeedbackQuery request, CancellationToken cancellationToken)
    {
        // Completed trainings for this learner (the join to Trainings applies the soft-delete
        // query filter, so feedback is never prompted for a deleted training).
        var completed = await _db.TrainingProgress
            .AsNoTracking()
            .Where(p => p.EmployeeId == request.EmployeeId && p.Status == TrainingStatus.Completed)
            .Select(p => new
            {
                p.TrainingId,
                p.CompletedAt,
                p.Training.Title,
                p.Training.TrainingType,
            })
            .ToListAsync(cancellationToken);

        if (completed.Count == 0)
            return Result.Success(new List<PendingFeedbackDto>());

        var submittedTrainingIds = await _db.TrainingFeedbacks
            .AsNoTracking()
            .Where(f => f.EmployeeId == request.EmployeeId)
            .Select(f => f.TrainingId)
            .ToListAsync(cancellationToken);

        var submitted = submittedTrainingIds.ToHashSet();

        var pending = completed
            .Where(c => !submitted.Contains(c.TrainingId))
            .OrderByDescending(c => c.CompletedAt)
            .Select(c => new PendingFeedbackDto
            {
                TrainingId = c.TrainingId,
                TrainingTitle = c.Title,
                TrainingType = c.TrainingType.ToString(),
                // A Completed progress always has CompletedAt set (TrainingProgress.Complete());
                // .Value surfaces an invariant violation loudly rather than masking it.
                CompletedAt = c.CompletedAt!.Value,
            })
            .ToList();

        return Result.Success(pending);
    }
}
