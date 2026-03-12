using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Catalog;

public class GetAllTrainingsQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAllTrainings_WhenNoFiltersApplied()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(2, result.Value.Count);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyList_WhenNoCourses()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Handle_FiltersByCategory_WhenCategoryIdProvided()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        
        var category1 = new TrainingCategory("Tech", "Technical courses");
        var category2 = new TrainingCategory("Soft Skills", "Soft skills courses");
        context.Categories.AddRange(category1, category2);

        var course1 = new TrainingCourse("C# Basics", "Learn C#", 10, false, BadgeLevel.Bronze, category1.Id, "2h");
        var course2 = new TrainingCourse("Leadership", "Leadership skills", 15, false, BadgeLevel.Silver, category2.Id, "3h");
        context.Trainings.AddRange(course1, course2);
        await context.SaveChangesAsync();

        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(category1.Id, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal("C# Basics", result.Value![0].Title);
    }

    [Fact]
    public async Task Handle_FiltersBySearch_WhenSearchTermProvided()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, "Advanced");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Contains("Advanced", result.Value![0].Title);
    }

    [Fact]
    public async Task Handle_ReturnsOrderedByTitle()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var titles = result.Value!.Select(t => t.Title).ToList();
        Assert.Equal(titles.OrderBy(t => t).ToList(), titles);
    }

    [Fact]
    public async Task Handle_IncludesChapterCount()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, ".NET");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal(2, result.Value![0].ChapterCount);
    }
}
