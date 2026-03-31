using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateTrainingCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesTraining_WhenValidData()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateTrainingCommandHandler(context);
        var training = context.Trainings.First();
        var categoryId = training.CategoryId;

        var command = new UpdateTrainingCommand(
            training.Id, "Updated Title", "Updated Desc", 50, true, "Gold", "10 hours", categoryId);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        await context.Entry(training).ReloadAsync();
        Assert.Equal("Updated Title", training.Title);
        Assert.Equal(50, training.Credits);
        Assert.True(training.IsMandatory);
    }

    [Fact]
    public async Task Handle_UpdatesCategory_WhenNewCategoryProvided()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var newCategory = new TrainingCategory("New Category", "desc");
        context.Categories.Add(newCategory);
        await context.SaveChangesAsync();

        var handler = new UpdateTrainingCommandHandler(context);
        var training = context.Trainings.First();

        var command = new UpdateTrainingCommand(
            training.Id, training.Title, training.Description, training.Credits,
            training.IsMandatory, "Bronze", training.Duration, newCategory.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        await context.Entry(training).ReloadAsync();
        Assert.Equal(newCategory.Id, training.CategoryId);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateTrainingCommandHandler(context);
        var command = new UpdateTrainingCommand(
            Guid.NewGuid(), "Title", null, 10, false, "Bronze", null, Guid.NewGuid());

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenInvalidBadgeLevel()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateTrainingCommandHandler(context);
        var training = context.Trainings.First();

        var command = new UpdateTrainingCommand(
            training.Id, "Title", null, 10, false, "Platinum", null, training.CategoryId);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("InvalidBadgeLevel", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCategoryNotFound()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateTrainingCommandHandler(context);
        var training = context.Trainings.First();

        var command = new UpdateTrainingCommand(
            training.Id, "Title", null, 10, false, "Bronze", null, Guid.NewGuid());

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
