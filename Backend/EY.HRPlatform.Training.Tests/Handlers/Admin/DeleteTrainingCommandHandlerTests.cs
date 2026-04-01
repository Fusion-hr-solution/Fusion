using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class DeleteTrainingCommandHandlerTests
{
    [Fact]
    public async Task Handle_SoftDeletesTraining_WhenExists()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new DeleteTrainingCommandHandler(context);
        var training = context.Trainings.First();

        var result = await handler.Handle(new DeleteTrainingCommand(training.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await context.Entry(training).ReloadAsync();
        Assert.True(training.IsDeleted);
        Assert.NotNull(training.DeletedAt);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteTrainingCommandHandler(context);

        var result = await handler.Handle(new DeleteTrainingCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
