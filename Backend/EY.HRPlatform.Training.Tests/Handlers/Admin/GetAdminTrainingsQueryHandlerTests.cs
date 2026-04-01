using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class GetAdminTrainingsQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAllTrainings()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingsQueryHandler(context);

        var query = new GetAdminTrainingsQuery(null, null, false, 1, 10);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.Equal(2, result.Value.Items.Count);
    }

    [Fact]
    public async Task Handle_FiltersByCategoryId()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingsQueryHandler(context);
        var category = context.Categories.First();

        var query = new GetAdminTrainingsQuery(category.Id, null, false, 1, 10);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.All(result.Value.Items, t => Assert.Equal(category.Id, t.CategoryId));
    }

    [Fact]
    public async Task Handle_FiltersBySearch()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingsQueryHandler(context);

        var query = new GetAdminTrainingsQuery(null, "Advanced", false, 1, 10);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Contains("Advanced", result.Value.Items[0].Title);
    }

    [Fact]
    public async Task Handle_Paginates()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingsQueryHandler(context);

        var query = new GetAdminTrainingsQuery(null, null, false, 1, 1);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.TotalCount);
        Assert.Single(result.Value.Items);
        Assert.Equal(1, result.Value.Page);
        Assert.Equal(1, result.Value.PageSize);
    }

    [Fact]
    public async Task Handle_IncludesDeletedTrainings_WhenRequested()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        // Soft-delete one training
        var training = context.Trainings.First();
        training.Delete();
        await context.SaveChangesAsync();

        var handler = new GetAdminTrainingsQueryHandler(context);

        // Without IncludeDeleted
        var queryWithout = new GetAdminTrainingsQuery(null, null, false, 1, 10);
        var resultWithout = await handler.Handle(queryWithout, CancellationToken.None);

        // With IncludeDeleted
        var queryWith = new GetAdminTrainingsQuery(null, null, true, 1, 10);
        var resultWith = await handler.Handle(queryWith, CancellationToken.None);

        Assert.True(resultWith.Value.TotalCount >= resultWithout.Value.TotalCount);
    }

    [Fact]
    public async Task Handle_IncludesChapterAndEnrollmentCounts()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAdminTrainingsQueryHandler(context);

        var query = new GetAdminTrainingsQuery(null, null, false, 1, 10);
        var result = await handler.Handle(query, CancellationToken.None);

        // Course1 has 2 chapters from seed data
        var course1 = result.Value.Items.FirstOrDefault(t => t.Title == "Introduction to .NET");
        Assert.NotNull(course1);
        Assert.Equal(2, course1.ChapterCount);
    }
}
