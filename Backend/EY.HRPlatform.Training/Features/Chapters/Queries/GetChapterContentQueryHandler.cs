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

        // 2. Load the chapter with its training and content blocks
        var chapter = await _db.Chapters
            .AsNoTracking()
            .Include(c => c.Training)
            .Include(c => c.ContentBlocks.OrderBy(b => b.OrderIndex))
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

        // 5. Load per-block progress
        var blockIds = chapter.ContentBlocks.Select(b => b.Id).ToList();
        var blockProgressSet = await _db.ContentBlockProgress
            .AsNoTracking()
            .Where(p => p.EmployeeId == request.EmployeeId && blockIds.Contains(p.ContentBlockId) && p.Completed)
            .Select(p => p.ContentBlockId)
            .ToListAsync(cancellationToken);
        var completedBlockIds = blockProgressSet.ToHashSet();

        return Result.Success(new ChapterContentDto
        {
            Id = chapter.Id,
            Title = chapter.Title,
            Layout = chapter.Layout.ToString(),
            OrderIndex = chapter.OrderIndex,
            TrainingId = chapter.TrainingId,
            TrainingTitle = chapter.Training.Title,
            TotalChapters = allChapters.Count,
            NextChapterId = nextChapterId,
            PreviousChapterId = previousChapterId,
            IsCompleted = isCompleted,
            ContentBlocks = chapter.ContentBlocks.Select(b => new ContentBlockDto
            {
                Id = b.Id,
                Type = b.Type.ToString(),
                OrderIndex = b.OrderIndex,
                Title = b.Title,
                TextContent = b.TextContent,
                ContentUri = b.ContentUri,
                VideoUrl = b.VideoUrl,
                EstimatedDurationMinutes = b.EstimatedDurationMinutes,
                IsCompleted = completedBlockIds.Contains(b.Id)
            }).ToList()
        });
    }
}
