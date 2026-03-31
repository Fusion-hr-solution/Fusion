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
            "Updated Title", "Pdf", "https://example.com/updated.pdf", 5,
            null, null, 60);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.Chapters.FindAsync(chapter.Id);
        Assert.NotNull(updated);
        Assert.Equal("Updated Title", updated.Title);
        Assert.Equal(Domain.Enums.ContentType.Pdf, updated.ContentType);
        Assert.Equal(5, updated.OrderIndex);
        Assert.Equal(60, updated.EstimatedDurationMinutes);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var training = context.Trainings.First();

        var command = new UpdateChapterCommand(
            training.Id, Guid.NewGuid(),
            "Title", "Article", null, 0, null, null, null);

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
            "Title", "Article", null, 0, null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidContentType()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateChapterCommandHandler(context);
        var chapter = context.Chapters.First();

        var command = new UpdateChapterCommand(
            chapter.TrainingId, chapter.Id,
            "Title", "InvalidType", null, 0, null, null, null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidContentType", result.Error.Code);
    }
}
