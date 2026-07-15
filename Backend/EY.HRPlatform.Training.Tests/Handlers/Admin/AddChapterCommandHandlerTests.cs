using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class AddChapterCommandHandlerTests
{
    [Fact]
    public async Task Handle_AddsChapter_WhenValidData()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AddChapterCommandHandler(context, new FakePdfTextExtractor());
        var training = context.Trainings.First();

        var blocks = new List<AddChapterContentBlockItem>
        {
            new("Article", 0, "Block 1", "Hello world", null, null, 30)
        };
        var command = new AddChapterCommand(
            training.Id, "New Chapter", "SingleContent", 10, blocks);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var chapter = await context.Chapters.FindAsync(result.Value);
        Assert.NotNull(chapter);
        Assert.Equal("New Chapter", chapter.Title);
        Assert.Equal(training.Id, chapter.TrainingId);
    }

    [Fact]
    public async Task Handle_AddsChapterWithVideoBlock()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AddChapterCommandHandler(context, new FakePdfTextExtractor());
        var training = context.Trainings.First();

        var blocks = new List<AddChapterContentBlockItem>
        {
            new("Video", 0, "Video Block", null, null, "https://youtube.com/watch?v=123", 45)
        };
        var command = new AddChapterCommand(
            training.Id, "Video Chapter", "SingleContent", 20, blocks);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var chapter = await context.Chapters.FindAsync(result.Value);
        Assert.NotNull(chapter);
        Assert.Equal(ChapterLayout.SingleContent, chapter.Layout);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddChapterCommandHandler(context, new FakePdfTextExtractor());
        var command = new AddChapterCommand(
            Guid.NewGuid(), "Chapter", "SingleContent", 0, []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidLayout()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AddChapterCommandHandler(context, new FakePdfTextExtractor());
        var training = context.Trainings.First();

        var command = new AddChapterCommand(
            training.Id, "Bad Chapter", "InvalidLayout", 0, []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidLayout", result.Error.Code);
    }
}
