using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public class UpdateChapterProgressCommandHandler : ICommandHandler<UpdateChapterProgressCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateChapterProgressCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateChapterProgressCommand request, CancellationToken cancellationToken)
    {
        // Verify the employee is enrolled
        var isEnrolled = await _db.Assignments
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (!isEnrolled)
            return Result.Failure(new Error("Enrollment.NotFound", "You are not enrolled in this training."));

        // Verify the chapter belongs to the training
        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId, cancellationToken);

        if (chapter is null)
            return Result.Failure(new Error("Chapter.NotFound", "Chapter not found in this training."));

        // Upsert chapter progress
        var chapterProgress = await _db.ChapterProgress
            .FirstOrDefaultAsync(cp => cp.EmployeeId == request.EmployeeId && cp.ChapterId == request.ChapterId, cancellationToken);

        if (chapterProgress is null)
        {
            chapterProgress = new ChapterProgress(request.EmployeeId, request.ChapterId);
            _db.ChapterProgress.Add(chapterProgress);
        }

        if (request.Completed && !chapterProgress.Completed)
            chapterProgress.MarkCompleted();

        // Save chapter progress first so the count query includes it
        await _db.SaveChangesAsync(cancellationToken);

        // Recalculate overall training progress
        await RecalculateTrainingProgressAsync(request.EmployeeId, request.TrainingId, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private async Task RecalculateTrainingProgressAsync(Guid employeeId, Guid trainingId, CancellationToken cancellationToken)
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

        trainingProgress.UpdateProgress(percentage);
    }
}
