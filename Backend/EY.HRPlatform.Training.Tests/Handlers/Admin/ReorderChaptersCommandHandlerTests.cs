using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class ReorderChaptersCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReordersChapters_WhenIdsAreValid()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var training = context.Trainings.First();
        var chapters = await context.Chapters
            .Where(c => c.TrainingId == training.Id)
            .OrderBy(c => c.OrderIndex)
            .ToListAsync();

        // Reverse the order
        var reversedIds = chapters.Select(c => c.Id).Reverse().ToList();

        var command = new ReorderChaptersCommand(training.Id, reversedIds);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.Chapters
            .Where(c => c.TrainingId == training.Id)
            .OrderBy(c => c.OrderIndex)
            .ToListAsync();
        Assert.Equal(reversedIds, updated.Select(c => c.Id).ToList());
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var chapters = context.Chapters.ToList();

        var command = new ReorderChaptersCommand(Guid.NewGuid(), chapters.Select(c => c.Id).ToList());
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCountMismatch()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var training = context.Trainings.First();
        var oneChapterId = context.Chapters.First(c => c.TrainingId == training.Id).Id;

        // Pass only 1 ID when training has 2 chapters
        var command = new ReorderChaptersCommand(training.Id, [oneChapterId]);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("CountMismatch", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterIdDoesNotBelongToTraining()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var training = context.Trainings.First();
        var chapters = await context.Chapters
            .Where(c => c.TrainingId == training.Id)
            .ToListAsync();

        // Replace one real ID with a bogus one
        var invalidIds = chapters.Select(c => c.Id).ToList();
        invalidIds[0] = Guid.NewGuid();

        var command = new ReorderChaptersCommand(training.Id, invalidIds);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidId", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterIdsContainDuplicates()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var training = context.Trainings.First();
        var chapters = await context.Chapters
            .Where(c => c.TrainingId == training.Id)
            .ToListAsync();

        // Duplicate the first ID
        var duplicateIds = Enumerable.Repeat(chapters[0].Id, chapters.Count).ToList();

        var command = new ReorderChaptersCommand(training.Id, duplicateIds);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("DuplicateIds", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenListIsEmpty()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new ReorderChaptersCommandHandler(context);
        var training = context.Trainings.First();

        var command = new ReorderChaptersCommand(training.Id, []);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("EmptyReorderList", result.Error.Code);
    }
}
