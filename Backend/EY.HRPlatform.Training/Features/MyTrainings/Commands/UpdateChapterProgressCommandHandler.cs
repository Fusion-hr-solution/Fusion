using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public class UpdateContentBlockProgressCommandHandler : ICommandHandler<UpdateContentBlockProgressCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateContentBlockProgressCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateContentBlockProgressCommand request, CancellationToken cancellationToken)
    {
        // Verify enrollment
        var isEnrolled = await _db.Assignments
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (!isEnrolled)
            return Result.Failure(new Error("Enrollment.NotFound", "You are not enrolled in this training."));

        // Determine once whether this training has an exam (avoids repeated DB hit per block completion).
        var hasExam = await _db.Exams.AnyAsync(e => e.TrainingId == request.TrainingId, cancellationToken);

        // Verify the content block belongs to the chapter and training
        var block = await _db.ContentBlocks
            .Include(b => b.Chapter)
            .FirstOrDefaultAsync(b => b.Id == request.ContentBlockId
                                   && b.ChapterId == request.ChapterId
                                   && b.Chapter.TrainingId == request.TrainingId, cancellationToken);

        if (block is null)
            return Result.Failure(new Error("ContentBlock.NotFound", "Content block not found in this chapter."));

        // Upsert content block progress
        var blockProgress = await _db.ContentBlockProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId
                                   && p.ContentBlockId == request.ContentBlockId, cancellationToken);

        if (blockProgress is null)
        {
            blockProgress = new ContentBlockProgress(request.EmployeeId, request.ContentBlockId);
            _db.ContentBlockProgress.Add(blockProgress);
        }

        if (request.Completed && !blockProgress.Completed)
            blockProgress.MarkCompleted();

        await _db.SaveChangesAsync(cancellationToken);

        // Auto-complete chapter if all blocks are done
        await AutoCompleteChapterAsync(request.EmployeeId, request.ChapterId, cancellationToken);

        // Flush chapter progress to DB so RecalculateTrainingProgressAsync sees it
        await _db.SaveChangesAsync(cancellationToken);

        // Recalculate overall training progress
        await RecalculateTrainingProgressAsync(request.EmployeeId, request.TrainingId, hasExam, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private async Task AutoCompleteChapterAsync(Guid employeeId, Guid chapterId, CancellationToken cancellationToken)
    {
        var totalBlocks = await _db.ContentBlocks
            .CountAsync(b => b.ChapterId == chapterId, cancellationToken);

        if (totalBlocks == 0) return;

        var blockIds = await _db.ContentBlocks
            .Where(b => b.ChapterId == chapterId)
            .Select(b => b.Id)
            .ToListAsync(cancellationToken);

        var completedBlocks = await _db.ContentBlockProgress
            .CountAsync(p => p.EmployeeId == employeeId && p.Completed && blockIds.Contains(p.ContentBlockId),
                cancellationToken);

        var allBlocksDone = completedBlocks >= totalBlocks;

        var chapterProgress = await _db.ChapterProgress
            .FirstOrDefaultAsync(cp => cp.EmployeeId == employeeId && cp.ChapterId == chapterId, cancellationToken);

        if (allBlocksDone)
        {
            if (chapterProgress is null)
            {
                chapterProgress = new ChapterProgress(employeeId, chapterId);
                _db.ChapterProgress.Add(chapterProgress);
            }

            if (!chapterProgress.Completed)
                chapterProgress.MarkCompleted();
        }
    }

    private async Task RecalculateTrainingProgressAsync(Guid employeeId, Guid trainingId, bool hasExam, CancellationToken cancellationToken)
    {
        var totalChapters = await _db.Chapters.CountAsync(c => c.TrainingId == trainingId, cancellationToken);
        if (totalChapters == 0) return;

        var chapterIds = await _db.Chapters
            .Where(c => c.TrainingId == trainingId)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        var completedChapters = await _db.ChapterProgress
            .CountAsync(cp => cp.EmployeeId == employeeId && cp.Completed && chapterIds.Contains(cp.ChapterId), cancellationToken);

        var percentage = (int)((double)completedChapters / totalChapters * 100);

        var trainingProgress = await _db.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.TrainingId == trainingId, cancellationToken);

        if (trainingProgress is null)
        {
            trainingProgress = new TrainingProgress(employeeId, trainingId);
            _db.TrainingProgress.Add(trainingProgress);
            trainingProgress.Start();
        }
        else if (trainingProgress.ProgressPercentage == 0 && percentage > 0)
        {
            trainingProgress.Start();
        }

        // When the training has an exam, chapter completion alone does NOT complete the training.
        // Completion happens only after the exam is passed (see SubmitExamCommandHandler).
        if (hasExam)
        {
            trainingProgress.SetProgressPercentage(percentage);
        }
        else
        {
            trainingProgress.UpdateProgress(percentage);
        }
    }
}
