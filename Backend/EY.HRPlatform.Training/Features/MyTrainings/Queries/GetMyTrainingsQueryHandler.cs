using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public class GetMyTrainingsQueryHandler : IQueryHandler<GetMyTrainingsQuery, Result<List<MyTrainingDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyTrainingsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<MyTrainingDto>>> Handle(GetMyTrainingsQuery request, CancellationToken cancellationToken)
    {
        var query = _db.Assignments
            .AsNoTracking()
            .Include(a => a.Training)
                .ThenInclude(t => t.Category)
            .Include(a => a.Training)
                .ThenInclude(t => t.Chapters)
            .Where(a => a.EmployeeId == request.EmployeeId)
            .AsQueryable();

        var assignments = await query.ToListAsync(cancellationToken);

        // Load progress records for this employee's trainings
        var trainingIds = assignments.Select(a => a.TrainingId).ToList();
        var progressMap = await _db.TrainingProgress
            .AsNoTracking()
            .Where(p => p.EmployeeId == request.EmployeeId && trainingIds.Contains(p.TrainingId))
            .ToDictionaryAsync(p => p.TrainingId, cancellationToken);

        var completedChaptersMap = await _db.ChapterProgress
            .AsNoTracking()
            .Where(cp => cp.EmployeeId == request.EmployeeId && cp.Completed)
            .Join(_db.Chapters.Where(c => trainingIds.Contains(c.TrainingId)),
                cp => cp.ChapterId,
                c => c.Id,
                (cp, c) => c.TrainingId)
            .GroupBy(trainingId => trainingId)
            .Select(g => new { TrainingId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.TrainingId, g => g.Count, cancellationToken);

        var result = assignments.Select(a =>
        {
            progressMap.TryGetValue(a.TrainingId, out var progress);
            completedChaptersMap.TryGetValue(a.TrainingId, out var completedChapters);

            return new MyTrainingDto
            {
                TrainingId = a.TrainingId,
                Title = a.Training.Title,
                Description = a.Training.Description,
                CategoryName = a.Training.Category.Name,
                Duration = a.Training.Duration,
                Credits = a.Training.Credits,
                IsMandatory = a.Training.IsMandatory,
                BadgeLevel = a.Training.BadgeLevel.ToString(),
                Status = progress?.Status.ToString() ?? TrainingStatus.NotStarted.ToString(),
                ProgressPercentage = progress?.ProgressPercentage ?? 0,
                CompletedChapters = completedChapters,
                TotalChapters = a.Training.Chapters.Count,
                StartedAt = progress?.StartedAt,
                CompletedAt = progress?.CompletedAt,
                AssignmentType = a.AssignmentType.ToString(),
                DueDate = a.DueDate
            };
        }).ToList();

        if (request.StatusFilter.HasValue)
        {
            result = result.Where(t => t.Status == request.StatusFilter.Value.ToString()).ToList();
        }

        return Result.Success(result.OrderBy(t => t.Title).ToList());
    }
}
