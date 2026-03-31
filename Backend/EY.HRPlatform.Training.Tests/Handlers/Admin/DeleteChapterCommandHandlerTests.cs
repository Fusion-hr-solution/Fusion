using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class DeleteChapterCommandHandlerTests
{
    [Fact]
    public async Task Handle_DeletesChapter_WhenExists()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new DeleteChapterCommandHandler(context);
        var chapter = context.Chapters.First();
        var chapterId = chapter.Id;

        var command = new DeleteChapterCommand(chapter.TrainingId, chapterId);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await context.Chapters.FindAsync(chapterId));
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new DeleteChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new DeleteChapterCommand(training.Id, Guid.NewGuid());
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingIdMismatch()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new DeleteChapterCommandHandler(context);
        var chapter = context.Chapters.First();

        var command = new DeleteChapterCommand(Guid.NewGuid(), chapter.Id);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
