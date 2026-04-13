using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Chapters.Queries;

public class GetChaptersWithProgressQueryHandler
    : IQueryHandler<GetChaptersWithProgressQuery, Result<List<ChapterListItemDto>>>
{
    private readonly TrainingDbContext _db;

    public GetChaptersWithProgressQueryHandler(TrainingDbContext db)
    {
        _db = db;
    }

    public async Task<Result<List<ChapterListItemDto>>> Handle(
        GetChaptersWithProgressQuery request,
        CancellationToken cancellationToken)
    {
        // 1. Verify enrollment
        var isEnrolled = await _db.Assignments
            .AsNoTracking()
            .AnyAsync(a => a.EmployeeId == request.EmployeeId
                        && a.TrainingId == request.TrainingId, cancellationToken);

        if (!isEnrolled)
            return Result.Failure<List<ChapterListItemDto>>(
                new Error("Enrollment.NotFound", "You must be enrolled in this training to view chapters."));

        // 2. Verify training exists
        var trainingExists = await _db.Trainings
            .AsNoTracking()
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<List<ChapterListItemDto>>(
                Error.NotFound("Training", request.TrainingId));

        // 3. Load chapters with progress
        var chapters = await _db.Chapters
            .AsNoTracking()
            .Where(c => c.TrainingId == request.TrainingId)
            .OrderBy(c => c.OrderIndex)
            .Select(c => new
            {
                c.Id,
                c.Title,
                Layout = c.Layout.ToString(),
                c.OrderIndex,
                BlockCount = c.ContentBlocks.Count,
                CompletedBlockCount = c.ContentBlocks
                    .Count(b => b.ProgressRecords
                        .Any(p => p.EmployeeId == request.EmployeeId && p.Completed)),
                Progress = c.ProgressRecords
                    .Where(p => p.EmployeeId == request.EmployeeId)
                    .Select(p => new { p.Completed, p.CompletedAt })
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var result = chapters.Select(c => new ChapterListItemDto
        {
            Id = c.Id,
            Title = c.Title,
            Layout = c.Layout,
            OrderIndex = c.OrderIndex,
            BlockCount = c.BlockCount,
            CompletedBlockCount = c.CompletedBlockCount,
            IsCompleted = c.Progress?.Completed ?? false,
            CompletedAt = c.Progress?.CompletedAt
        }).ToList();

        return Result.Success(result);
    }
}
