using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class CreateTrainingCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesTraining_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var category = new TrainingCategory("Technical", "Tech courses");
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var handler = new CreateTrainingCommandHandler(context);
        var command = new CreateTrainingCommand(
            "New Training", "Description", 10, false, "Bronze", "2 hours", category.Id,
            TrainingType.ELearning.ToString(), null, [], []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var training = await context.Trainings.FindAsync(result.Value);
        Assert.NotNull(training);
        Assert.Equal("New Training", training.Title);
    }

    [Fact]
    public async Task Handle_CreatesTrainingWithChapters_WhenChaptersProvided()
    {
        await using var context = TestDbContextFactory.Create();
        var category = new TrainingCategory("Technical", "Tech courses");
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var handler = new CreateTrainingCommandHandler(context);
        var chapters = new List<CreateTrainingChapterItem>
        {
            new("Chapter 1", "SingleContent", 0, [new("Article", 0, "Block 1", "Content", null, null, 30)]),
            new("Chapter 2", "SingleContent", 1, [new("Video", 0, "Block 2", null, null, "https://example.com", 45)]),
        };
        var command = new CreateTrainingCommand(
            "Training With Chapters", null, 20, true, "Gold", "5 hours", category.Id,
            TrainingType.ELearning.ToString(), null, chapters, []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var savedChapters = context.Chapters.Where(c => c.TrainingId == result.Value).ToList();
        Assert.Equal(2, savedChapters.Count);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCategoryNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateTrainingCommandHandler(context);
        var command = new CreateTrainingCommand(
            "Training", null, 10, false, "Bronze", null, Guid.NewGuid(),
            TrainingType.ELearning.ToString(), null, [], []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidBadgeLevel()
    {
        await using var context = TestDbContextFactory.Create();
        var category = new TrainingCategory("Tech", "desc");
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var handler = new CreateTrainingCommandHandler(context);
        var command = new CreateTrainingCommand(
            "Training", null, 10, false, "InvalidLevel", null, category.Id,
            TrainingType.ELearning.ToString(), null, [], []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidBadgeLevel", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenChapterHasInvalidContentType()
    {
        await using var context = TestDbContextFactory.Create();
        var category = new TrainingCategory("Tech", "desc");
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var handler = new CreateTrainingCommandHandler(context);
        var chapters = new List<CreateTrainingChapterItem>
        {
            new("Bad Chapter", "SingleContent", 0, [new("InvalidType", 0, null, null, null, null, null)]),
        };
        var command = new CreateTrainingCommand(
            "Training", null, 10, false, "Bronze", null, category.Id,
            TrainingType.ELearning.ToString(), null, chapters, []);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidType", result.Error.Code);
    }
}
