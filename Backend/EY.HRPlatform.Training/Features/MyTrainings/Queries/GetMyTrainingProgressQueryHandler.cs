using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public class GetMyTrainingProgressQueryHandler : IQueryHandler<GetMyTrainingProgressQuery, Result<MyTrainingDto>>
{
    private readonly TrainingDbContext _db;

    public GetMyTrainingProgressQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<MyTrainingDto>> Handle(GetMyTrainingProgressQuery request, CancellationToken cancellationToken)
    {
        var assignment = await _db.Assignments
            .AsNoTracking()
            .Include(a => a.Training)
                .ThenInclude(t => t.Category)
            .Include(a => a.Training)
                .ThenInclude(t => t.Chapters)
            .FirstOrDefaultAsync(a =>
                a.EmployeeId == request.EmployeeId &&
                a.TrainingId == request.TrainingId,
                cancellationToken);

        if (assignment is null)
            return Result.Failure<MyTrainingDto>(new Error("Assignment.NotFound", "Training not found in your enrollments."));

        var progress = await _db.TrainingProgress
            .AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.EmployeeId == request.EmployeeId &&
                p.TrainingId == request.TrainingId,
                cancellationToken);

        var completedChapters = await _db.ChapterProgress
            .AsNoTracking()
            .CountAsync(cp =>
                cp.EmployeeId == request.EmployeeId &&
                cp.Completed &&
                assignment.Training.Chapters.Select(c => c.Id).Contains(cp.ChapterId),
                cancellationToken);

        var ratings = await _db.TrainingFeedbacks
            .AsNoTracking()
            .Where(f => f.TrainingId == request.TrainingId)
            .GroupBy(f => f.TrainingId)
            .Select(g => new { Count = g.Count(), Avg = g.Average(f => (double)f.OverallRating) })
            .FirstOrDefaultAsync(cancellationToken);

        var dto = new MyTrainingDto
        {
            TrainingId = assignment.TrainingId,
            Title = assignment.Training.Title,
            Description = assignment.Training.Description,
            CategoryName = assignment.Training.Category.Name,
            Duration = assignment.Training.Duration,
            Credits = assignment.Training.Credits,
            IsMandatory = assignment.Training.IsMandatory,
            BadgeLevel = assignment.Training.BadgeLevel.ToString(),
            Status = progress?.Status.ToString() ?? TrainingStatus.NotStarted.ToString(),
            ProgressPercentage = progress?.ProgressPercentage ?? 0,
            CompletedChapters = completedChapters,
            TotalChapters = assignment.Training.Chapters.Count,
            StartedAt = progress?.StartedAt,
            CompletedAt = progress?.CompletedAt,
            AssignmentType = assignment.AssignmentType.ToString(),
            DueDate = assignment.DueDate,
            AverageRating = ratings is null ? null : Math.Round(ratings.Avg, 2),
            RatingCount = ratings?.Count ?? 0
        };

        return Result.Success(dto);
    }
}
