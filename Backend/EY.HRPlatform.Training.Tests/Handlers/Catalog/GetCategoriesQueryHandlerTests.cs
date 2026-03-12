using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Catalog;

public class GetCategoriesQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAllCategories()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetCategoriesQueryHandler(context);
        var query = new GetCategoriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Single(result.Value);
        Assert.Equal("Technical Skills", result.Value[0].Name);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyList_WhenNoCategories()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        var handler = new GetCategoriesQueryHandler(context);
        var query = new GetCategoriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Handle_IncludesTrainingCount()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetCategoriesQueryHandler(context);
        var query = new GetCategoriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal(2, result.Value![0].TrainingCount);
    }

    [Fact]
    public async Task Handle_ReturnsOrderedByName()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        context.Categories.Add(new TrainingCategory("Soft Skills", "Soft skills training"));
        context.Categories.Add(new TrainingCategory("Compliance", "Compliance training"));
        context.Categories.Add(new TrainingCategory("Technical", "Technical training"));
        await context.SaveChangesAsync();

        var handler = new GetCategoriesQueryHandler(context);
        var query = new GetCategoriesQuery();

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Count);
        Assert.Equal("Compliance", result.Value[0].Name);
        Assert.Equal("Soft Skills", result.Value[1].Name);
        Assert.Equal("Technical", result.Value[2].Name);
    }
}
