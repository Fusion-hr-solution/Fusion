using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class DeleteCategoryCommandHandlerTests
{
    [Fact]
    public async Task Handle_DeletesCategory_WhenNoTrainings()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteCategoryCommandHandler(context);
        var category = new TrainingCategory("Empty Category", null);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var command = new DeleteCategoryCommand(category.Id);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await context.Categories.FindAsync(category.Id));
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCategoryNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteCategoryCommandHandler(context);

        var command = new DeleteCategoryCommand(Guid.NewGuid());
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCategoryHasTrainings()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new DeleteCategoryCommandHandler(context);
        var category = context.Categories.First();

        var command = new DeleteCategoryCommand(category.Id);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("HasTrainings", result.Error.Code);
    }
}
