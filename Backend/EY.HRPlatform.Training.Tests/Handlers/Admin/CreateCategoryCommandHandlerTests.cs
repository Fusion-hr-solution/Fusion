using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class CreateCategoryCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesCategory_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateCategoryCommandHandler(context);

        var command = new CreateCategoryCommand("Leadership", "Leadership courses");
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var category = await context.Categories.FindAsync(result.Value);
        Assert.NotNull(category);
        Assert.Equal("Leadership", category.Name);
        Assert.Equal("Leadership courses", category.Description);
    }

    [Fact]
    public async Task Handle_CreatesCategory_WithNullDescription()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateCategoryCommandHandler(context);

        var command = new CreateCategoryCommand("Soft Skills", null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var category = await context.Categories.FindAsync(result.Value);
        Assert.NotNull(category);
        Assert.Null(category.Description);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateName()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new CreateCategoryCommandHandler(context);

        var command = new CreateCategoryCommand("Technical Skills", null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }
}
