using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateCategoryCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesCategory_WhenValidData()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateCategoryCommandHandler(context);
        var category = context.Categories.First();

        var command = new UpdateCategoryCommand(category.Id, "Updated Name", "Updated desc");
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.Categories.FindAsync(category.Id);
        Assert.NotNull(updated);
        Assert.Equal("Updated Name", updated.Name);
        Assert.Equal("Updated desc", updated.Description);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCategoryNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateCategoryCommandHandler(context);

        var command = new UpdateCategoryCommand(Guid.NewGuid(), "Name", null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateName()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateCategoryCommandHandler(context);

        // Add a second category
        var secondCategory = new Domain.Entities.TrainingCategory("Soft Skills", null);
        context.Categories.Add(secondCategory);
        await context.SaveChangesAsync();

        // Try to rename second category to the same name as the first
        var command = new UpdateCategoryCommand(secondCategory.Id, "Technical Skills", null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_AllowsSameNameForSameCategory()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new UpdateCategoryCommandHandler(context);
        var category = context.Categories.First();

        // Update with same name but different description
        var command = new UpdateCategoryCommand(category.Id, category.Name, "New description");
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
    }
}
