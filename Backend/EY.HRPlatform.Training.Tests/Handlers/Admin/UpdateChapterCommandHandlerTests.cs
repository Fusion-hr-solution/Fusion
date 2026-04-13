using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateChapterCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesChapter_WhenValidData()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var chapter = context.Chapters.First();

        var command = new UpdateChapterCommand(
            chapter.TrainingId, chapter.Id,
            "Updated Title", "SplitLayout");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.Chapters.FindAsync(chapter.Id);
        Assert.NotNull(updated);
        Assert.Equal("Updated Title", updated.Title);
        Assert.Equal(Domain.Enums.ChapterLayout.SplitLayout, updated.Layout);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new UpdateChapterCommand(
            training.Id, Guid.NewGuid(),
            "Title", "SingleContent");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingIdMismatch()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var chapter = context.Chapters.First();

        var command = new UpdateChapterCommand(
            Guid.NewGuid(), chapter.Id,
            "Title", "SingleContent");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidLayout()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var chapter = context.Chapters.First();

        var command = new UpdateChapterCommand(
            chapter.TrainingId, chapter.Id,
            "Title", "InvalidLayout");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidLayout", result.Error.Code);
    }
}
