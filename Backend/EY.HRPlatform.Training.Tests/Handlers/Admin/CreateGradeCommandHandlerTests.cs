using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class CreateGradeCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesGrade_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateGradeCommandHandler(context);

        var result = await handler.Handle(
            new CreateGradeCommand("Staff", 10, "Entry level", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var grade = await context.Grades.FindAsync(result.Value);
        Assert.NotNull(grade);
        Assert.Equal("Staff", grade.Name);
        Assert.Equal(10, grade.Level);
        Assert.Equal("Entry level", grade.Description);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateName()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateGradeCommandHandler(context);
        context.Grades.Add(new Grade("Staff", 10, null, null));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new CreateGradeCommand("Staff", 20, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateLevel()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new CreateGradeCommandHandler(context);
        context.Grades.Add(new Grade("Staff", 10, null, null));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new CreateGradeCommand("Senior", 10, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("LevelDuplicate", result.Error.Code);
    }
}
