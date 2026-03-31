using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class GetAdminTrainingDetailQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTrainingDetail_WithChapters()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingDetailQueryHandler(context);
        var training = context.Trainings.First();

        var query = new GetAdminTrainingDetailQuery(training.Id);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(training.Id, result.Value.Id);
        Assert.Equal(training.Title, result.Value.Title);
        Assert.NotNull(result.Value.CategoryName);
        Assert.NotEmpty(result.Value.Chapters);
    }

    [Fact]
    public async Task Handle_ReturnsChaptersOrderedByIndex()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingDetailQueryHandler(context);
        var training = context.Trainings.First(t => t.Title == "Introduction to .NET");

        var query = new GetAdminTrainingDetailQuery(training.Id);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var chapters = result.Value.Chapters;
        Assert.Equal(2, chapters.Count);
        Assert.True(chapters[0].OrderIndex <= chapters[1].OrderIndex);
    }

    [Fact]
    public async Task Handle_ReturnsDeletedTraining()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        training.Delete();
        await context.SaveChangesAsync();

        var handler = new GetAdminTrainingDetailQueryHandler(context);
        var query = new GetAdminTrainingDetailQuery(training.Id);
        var result = await handler.Handle(query, CancellationToken.None);

        // Should still return deleted training (IgnoreQueryFilters)
        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsDeleted);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetAdminTrainingDetailQueryHandler(context);

        var query = new GetAdminTrainingDetailQuery(Guid.NewGuid());
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
