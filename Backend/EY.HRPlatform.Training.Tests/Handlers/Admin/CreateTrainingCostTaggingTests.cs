using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class CreateTrainingCostTaggingTests
{
    private static List<CreateTrainingChapterItem> NoChapters => [];
    private static List<CreateOnSiteCourseItem> NoOnSite => [];

    private static async Task<(Infrastructure.Persistence.TrainingDbContext ctx, Guid categoryId, Guid serviceLineId)> SeedAsync()
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var categoryId = ctx.Categories.First().Id;
        var sl = new ServiceLine("Tax", "TAX", "#10B981", null, false);
        ctx.ServiceLines.Add(sl);
        await ctx.SaveChangesAsync();
        return (ctx, categoryId, sl.Id);
    }

    [Fact]
    public async Task Create_ExternalOnSite_WithSponsor_Succeeds()
    {
        var (ctx, categoryId, slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingCommandHandler(ctx, new FakePdfTextExtractor()).Handle(new CreateTrainingCommand(
            "Ext", null, 0, false, "Bronze", null, categoryId, "OnSite", null, NoChapters, NoOnSite,
            CostType: "External", SponsoringServiceLineId: slId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var course = await ctx.Trainings.FindAsync(result.Value);
        Assert.Equal(CostType.External, course!.CostType);
        Assert.Equal(slId, course.SponsoringServiceLineId);
    }

    [Fact]
    public async Task Create_External_Fails_WhenNotOnSite()
    {
        var (ctx, categoryId, slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingCommandHandler(ctx, new FakePdfTextExtractor()).Handle(new CreateTrainingCommand(
            "Ext", null, 0, false, "Bronze", null, categoryId, "ELearning", null, NoChapters, NoOnSite,
            CostType: "External", SponsoringServiceLineId: slId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("CostTypeRequiresOnSite", result.Error.Code);
    }

    [Fact]
    public async Task Create_External_Fails_WhenNoSponsor()
    {
        var (ctx, categoryId, _slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingCommandHandler(ctx, new FakePdfTextExtractor()).Handle(new CreateTrainingCommand(
            "Ext", null, 0, false, "Bronze", null, categoryId, "OnSite", null, NoChapters, NoOnSite,
            CostType: "External", SponsoringServiceLineId: null), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("SponsorRequired", result.Error.Code);
    }

    [Fact]
    public async Task Create_External_Fails_WhenSponsorNotFound()
    {
        var (ctx, categoryId, _slId) = await SeedAsync();
        await using var _ = ctx;

        var result = await new CreateTrainingCommandHandler(ctx, new FakePdfTextExtractor()).Handle(new CreateTrainingCommand(
            "Ext", null, 0, false, "Bronze", null, categoryId, "OnSite", null, NoChapters, NoOnSite,
            CostType: "External", SponsoringServiceLineId: Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Create_Internal_Succeeds_AndClearsSponsor()
    {
        var (ctx, categoryId, slId) = await SeedAsync();
        await using var _ = ctx;

        // Internal tagging must ignore any sponsor passed in.
        var result = await new CreateTrainingCommandHandler(ctx, new FakePdfTextExtractor()).Handle(new CreateTrainingCommand(
            "Internal", null, 0, false, "Bronze", null, categoryId, "OnSite", null, NoChapters, NoOnSite,
            CostType: "Internal", SponsoringServiceLineId: slId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var course = await ctx.Trainings.FindAsync(result.Value);
        Assert.Equal(CostType.Internal, course!.CostType);
        Assert.Null(course.SponsoringServiceLineId);
    }
}
