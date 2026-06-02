using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Catalog;

public class CatalogTrainingTypeFilterTests
{
    private static async Task<(Guid catId, Guid eLearnId, Guid onSiteId)> SeedTwoTypesAsync(
        EY.HRPlatform.Training.Infrastructure.Persistence.TrainingDbContext ctx)
    {
        var category = new TrainingCategory("Tech", "Technical");
        ctx.Categories.Add(category);

        var eLearn = new TrainingCourse(
            "E-Learning Course", "online", 5, false, BadgeLevel.Bronze,
            category.Id, "1h", TrainingType.ELearning, null);

        var onSite = new TrainingCourse(
            "On-Site Course", "in-person", 10, true, BadgeLevel.Silver,
            category.Id, "3h", TrainingType.OnSite, null);

        ctx.Trainings.AddRange(eLearn, onSite);
        await ctx.SaveChangesAsync();
        return (category.Id, eLearn.Id, onSite.Id);
    }

    [Fact]
    public async Task Handle_FiltersByELearning_WhenTrainingTypeIsELearning()
    {
        await using var ctx = TestDbContextFactory.Create();
        var (_, eLearnId, _) = await SeedTwoTypesAsync(ctx);
        var handler = new GetAllTrainingsQueryHandler(ctx);

        var result = await handler.Handle(
            new GetAllTrainingsQuery(null, null, TrainingType.ELearning), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Items);
        Assert.Equal(eLearnId, result.Value!.Items[0].Id);
    }

    [Fact]
    public async Task Handle_FiltersByOnSite_WhenTrainingTypeIsOnSite()
    {
        await using var ctx = TestDbContextFactory.Create();
        var (_, _, onSiteId) = await SeedTwoTypesAsync(ctx);
        var handler = new GetAllTrainingsQueryHandler(ctx);

        var result = await handler.Handle(
            new GetAllTrainingsQuery(null, null, TrainingType.OnSite), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Items);
        Assert.Equal(onSiteId, result.Value!.Items[0].Id);
    }

    [Fact]
    public async Task Handle_ReturnsBoth_WhenTrainingTypeIsNull()
    {
        await using var ctx = TestDbContextFactory.Create();
        await SeedTwoTypesAsync(ctx);
        var handler = new GetAllTrainingsQueryHandler(ctx);

        var result = await handler.Handle(
            new GetAllTrainingsQuery(null, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Items.Count);
    }
}
