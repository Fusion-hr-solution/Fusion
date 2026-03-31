using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Chapters.Queries;

public class GetChapterContentQueryHandler
    : IQueryHandler<GetChapterContentQuery, Result<ChapterContentDto>>
{
    private readonly TrainingDbContext _db;

    public GetChapterContentQueryHandler(TrainingDbContext db)
    {
        _db = db;
    }

    public async Task<Result<ChapterContentDto>> Handle(
        GetChapterContentQuery request,
        CancellationToken cancellationToken)
    {
        // 1. Verify enrollment
        var isEnrolled = await _db.Assignments
            .AsNoTracking()
            .AnyAsync(a => a.EmployeeId == request.EmployeeId
                        && a.TrainingId == request.TrainingId, cancellationToken);

        if (!isEnrolled)
            return Result.Failure<ChapterContentDto>(
                new Error("Enrollment.NotFound", "You must be enrolled in this training to view chapter content."));

        // 2. Load the chapter with its training
        var chapter = await _db.Chapters
            .AsNoTracking()
            .Include(c => c.Training)
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId
                                   && c.TrainingId == request.TrainingId, cancellationToken);

        if (chapter is null)
            return Result.Failure<ChapterContentDto>(
                Error.NotFound("Chapter", request.ChapterId));

        // 3. Load all chapter IDs for navigation (prev/next)
        var allChapters = await _db.Chapters
            .AsNoTracking()
            .Where(c => c.TrainingId == request.TrainingId)
            .OrderBy(c => c.OrderIndex)
            .Select(c => new { c.Id, c.OrderIndex })
            .ToListAsync(cancellationToken);

        var currentIndex = allChapters.FindIndex(c => c.Id == chapter.Id);
        var previousChapterId = currentIndex > 0
            ? allChapters[currentIndex - 1].Id
            : (Guid?)null;
        var nextChapterId = currentIndex < allChapters.Count - 1
            ? allChapters[currentIndex + 1].Id
            : (Guid?)null;

        // 4. Check completion status
        var isCompleted = await _db.ChapterProgress
            .AsNoTracking()
            .AnyAsync(cp => cp.EmployeeId == request.EmployeeId
                         && cp.ChapterId == request.ChapterId
                         && cp.Completed, cancellationToken);

        return Result.Success(new ChapterContentDto
        {
            Id = chapter.Id,
            Title = chapter.Title,
            ContentType = chapter.ContentType.ToString(),
            ContentUri = chapter.ContentUri,
            TextContent = chapter.TextContent,
            VideoUrl = chapter.VideoUrl,
            EstimatedDurationMinutes = chapter.EstimatedDurationMinutes,
            OrderIndex = chapter.OrderIndex,
            TrainingId = chapter.TrainingId,
            TrainingTitle = chapter.Training.Title,
            TotalChapters = allChapters.Count,
            NextChapterId = nextChapterId,
            PreviousChapterId = previousChapterId,
            IsCompleted = isCompleted
        });
    }
}
