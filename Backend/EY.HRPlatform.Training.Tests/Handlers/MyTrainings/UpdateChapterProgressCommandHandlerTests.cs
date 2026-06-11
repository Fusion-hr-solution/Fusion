using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.MyTrainings;

public class UpdateContentBlockProgressCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotEnrolled()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var block = context.ContentBlocks.First(b => b.ChapterId == chapter.Id);
        var employeeId = Guid.NewGuid();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);
        var command = new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, true);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenContentBlockNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        var chapter = context.Chapters.First(c => c.TrainingId == training.Id);
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);
        var command = new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, Guid.NewGuid(), true);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("ContentBlock.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_CreatesBlockProgress_WhenValid()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var block = context.ContentBlocks.First(b => b.ChapterId == chapter.Id);
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);
        var command = new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, true);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);

        var progress = await context.ContentBlockProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.ContentBlockId == block.Id);
        Assert.NotNull(progress);
        Assert.True(progress.Completed);
    }

    [Fact]
    public async Task Handle_AutoCompletesChapter_WhenAllBlocksCompleted()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var blocks = context.ContentBlocks.Where(b => b.ChapterId == chapter.Id).ToList();
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);

        foreach (var block in blocks)
        {
            await handler.Handle(
                new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, true),
                CancellationToken.None);
        }

        var chapterProgress = await context.ChapterProgress
            .FirstOrDefaultAsync(cp => cp.EmployeeId == employeeId && cp.ChapterId == chapter.Id);
        Assert.NotNull(chapterProgress);
        Assert.True(chapterProgress.Completed);
    }

    [Fact]
    public async Task Handle_DoesNotCompleteBlock_WhenNotMarkedCompleted()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var block = context.ContentBlocks.First(b => b.ChapterId == chapter.Id);
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);
        var command = new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, false);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);

        var progress = await context.ContentBlockProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.ContentBlockId == block.Id);
        Assert.NotNull(progress);
        Assert.False(progress.Completed);
    }

    // -----------------------------------------------------------------
    // Exam-gated completion tests
    // -----------------------------------------------------------------

    [Fact]
    public async Task Handle_DoesNotCompleteTraining_WhenTrainingHasExamAndAllBlocksDone()
    {
        // Arrange: training WITH an exam — completing all chapters must NOT auto-complete training
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);

        // Attach an exam to the training
        context.Exams.Add(new Exam("Final Exam", 70, training.Id));
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);

        // Complete every block in every chapter
        foreach (var chapter in training.Chapters)
        {
            var blocks = context.ContentBlocks.Where(b => b.ChapterId == chapter.Id).ToList();
            foreach (var block in blocks)
            {
                await handler.Handle(
                    new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, true),
                    CancellationToken.None);
            }
        }

        // Progress percentage should be 100 but status must NOT be Completed
        var progress = await context.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.TrainingId == training.Id);
        Assert.NotNull(progress);
        Assert.Equal(100, progress.ProgressPercentage);
        Assert.NotEqual(TrainingStatus.Completed, progress.Status);
    }

    [Fact]
    public async Task Handle_CompletesTraining_WhenTrainingHasNoExamAndAllBlocksDone()
    {
        // Arrange: training WITHOUT an exam — completing all chapters auto-completes training
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var employeeId = Guid.NewGuid();

        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateContentBlockProgressCommandHandler(context, NoOpCertificateIssuanceService.Instance);

        // Complete every block in every chapter
        foreach (var chapter in training.Chapters)
        {
            var blocks = context.ContentBlocks.Where(b => b.ChapterId == chapter.Id).ToList();
            foreach (var block in blocks)
            {
                await handler.Handle(
                    new UpdateContentBlockProgressCommand(employeeId, training.Id, chapter.Id, block.Id, true),
                    CancellationToken.None);
            }
        }

        var progress = await context.TrainingProgress
            .FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.TrainingId == training.Id);
        Assert.NotNull(progress);
        Assert.Equal(TrainingStatus.Completed, progress.Status);
    }
}
