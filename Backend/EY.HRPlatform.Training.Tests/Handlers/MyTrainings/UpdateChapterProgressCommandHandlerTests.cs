using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.MyTrainings;

public class UpdateChapterProgressCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotEnrolled()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var employeeId = Guid.NewGuid();

        var handler = new UpdateChapterProgressCommandHandler(context);
        var command = new UpdateChapterProgressCommand(employeeId, training.Id, chapter.Id, true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterNotFound()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        var employeeId = Guid.NewGuid();

        // Enroll the employee
        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateChapterProgressCommandHandler(context);
        var command = new UpdateChapterProgressCommand(employeeId, training.Id, Guid.NewGuid(), true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Chapter.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_CreatesChapterProgress_WhenValid()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var employeeId = Guid.NewGuid();

        // Enroll the employee
        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateChapterProgressCommandHandler(context);
        var command = new UpdateChapterProgressCommand(employeeId, training.Id, chapter.Id, true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var progress = await context.ChapterProgress
            .FirstOrDefaultAsync(cp => cp.EmployeeId == employeeId && cp.ChapterId == chapter.Id);
        Assert.NotNull(progress);
        Assert.True(progress.Completed);
    }

    [Fact]
    public async Task Handle_UpdatesTrainingProgress_WhenChapterCompleted()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapters = training.Chapters.ToList();
        var employeeId = Guid.NewGuid();

        // Enroll the employee
        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateChapterProgressCommandHandler(context);

        // Act - complete first chapter
        var result = await handler.Handle(
            new UpdateChapterProgressCommand(employeeId, training.Id, chapters[0].Id, true),
            CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var trainingProgress = await context.TrainingProgress
            .FirstOrDefaultAsync(tp => tp.EmployeeId == employeeId && tp.TrainingId == training.Id);
        Assert.NotNull(trainingProgress);
        Assert.Equal(50, trainingProgress.ProgressPercentage); // 1 of 2 chapters = 50%
    }

    [Fact]
    public async Task Handle_SetsProgressTo100_WhenAllChaptersCompleted()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapters = training.Chapters.ToList();
        var employeeId = Guid.NewGuid();

        // Enroll the employee
        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateChapterProgressCommandHandler(context);

        // Act - complete all chapters
        foreach (var chapter in chapters)
        {
            await handler.Handle(
                new UpdateChapterProgressCommand(employeeId, training.Id, chapter.Id, true),
                CancellationToken.None);
        }

        // Assert
        var trainingProgress = await context.TrainingProgress
            .FirstOrDefaultAsync(tp => tp.EmployeeId == employeeId && tp.TrainingId == training.Id);
        Assert.NotNull(trainingProgress);
        Assert.Equal(100, trainingProgress.ProgressPercentage);
    }

    [Fact]
    public async Task Handle_DoesNotUpdateProgress_WhenNotCompleted()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.Include(t => t.Chapters).First();
        var chapter = training.Chapters.First();
        var employeeId = Guid.NewGuid();

        // Enroll the employee
        var assignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(assignment);
        await context.SaveChangesAsync();

        var handler = new UpdateChapterProgressCommandHandler(context);
        var command = new UpdateChapterProgressCommand(employeeId, training.Id, chapter.Id, false);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);

        var progress = await context.ChapterProgress
            .FirstOrDefaultAsync(cp => cp.EmployeeId == employeeId && cp.ChapterId == chapter.Id);
        Assert.NotNull(progress);
        Assert.False(progress.Completed);
    }
}
