using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public class GetMyTrainingDetailedProgressQueryHandler
    : IQueryHandler<GetMyTrainingDetailedProgressQuery, Result<MyTrainingProgressDto>>
{
    private readonly TrainingDbContext _db;

    public GetMyTrainingDetailedProgressQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<MyTrainingProgressDto>> Handle(
        GetMyTrainingDetailedProgressQuery request,
        CancellationToken cancellationToken)
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
            return Result.Failure<MyTrainingProgressDto>(
                new Error("Assignment.NotFound", "Training not found in your enrollments."));

        var training = assignment.Training;
        var chapterIds = training.Chapters.Select(c => c.Id).ToList();

        var progress = await _db.TrainingProgress
            .AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.EmployeeId == request.EmployeeId &&
                p.TrainingId == request.TrainingId,
                cancellationToken);

        var chapterProgressRecords = await _db.ChapterProgress
            .AsNoTracking()
            .Where(cp => cp.EmployeeId == request.EmployeeId && chapterIds.Contains(cp.ChapterId))
            .ToListAsync(cancellationToken);

        var completedCount = chapterProgressRecords.Count(cp => cp.Completed);

        return Result.Success(new MyTrainingProgressDto
        {
            TrainingId = training.Id,
            Title = training.Title,
            Description = training.Description,
            CategoryName = training.Category.Name,
            Duration = training.Duration,
            Credits = training.Credits,
            IsMandatory = training.IsMandatory,
            BadgeLevel = training.BadgeLevel.ToString(),
            Status = progress?.Status.ToString() ?? TrainingStatus.NotStarted.ToString(),
            ProgressPercentage = progress?.ProgressPercentage ?? 0,
            CompletedChapters = completedCount,
            TotalChapters = training.Chapters.Count,
            Chapters = training.Chapters
                .OrderBy(c => c.OrderIndex)
                .Select(c => new ChapterDetailDto
                {
                    Id = c.Id,
                    Title = c.Title,
                    ContentType = c.ContentType.ToString(),
                    ContentUri = c.ContentUri,
                    TextContent = c.TextContent,
                    VideoUrl = c.VideoUrl,
                    EstimatedDurationMinutes = c.EstimatedDurationMinutes,
                    OrderIndex = c.OrderIndex,
                })
                .ToList(),
            ChapterProgress = chapterProgressRecords
                .Select(cp => new ChapterProgressDto
                {
                    ChapterId = cp.ChapterId,
                    Completed = cp.Completed,
                    CompletedAt = cp.CompletedAt,
                })
                .ToList(),
        });
    }
}
