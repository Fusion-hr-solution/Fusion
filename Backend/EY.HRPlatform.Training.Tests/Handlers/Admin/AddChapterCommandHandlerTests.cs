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
        var handler = new AddChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new AddChapterCommand(
            training.Id, "New Chapter", "Article", null, 10, "Hello world", null, 30);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var chapter = await context.Chapters.FindAsync(result.Value);
        Assert.NotNull(chapter);
        Assert.Equal("New Chapter", chapter.Title);
        Assert.Equal(training.Id, chapter.TrainingId);
    }

    [Fact]
    public async Task Handle_AddsVideoChapter_WithVideoUrl()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AddChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new AddChapterCommand(
            training.Id, "Video Chapter", "Video", "https://example.com/vid", 20,
            null, "https://youtube.com/watch?v=123", 45);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var chapter = await context.Chapters.FindAsync(result.Value);
        Assert.NotNull(chapter);
        Assert.Equal(ContentType.Video, chapter.ContentType);
        Assert.Equal("https://youtube.com/watch?v=123", chapter.VideoUrl);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddChapterCommandHandler(context);
        var command = new AddChapterCommand(
            Guid.NewGuid(), "Chapter", "Article", null, 0, null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidContentType()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AddChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new AddChapterCommand(
            training.Id, "Bad Chapter", "InvalidType", null, 0, null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidContentType", result.Error.Code);
    }
}
