using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateGradeCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesGrade_WhenValidData()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateGradeCommandHandler(context);
        var grade = new Grade("Staff", 10, "Old desc", null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpdateGradeCommand(grade.Id, "Senior Staff", 15, "New desc", "star"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.Grades.FindAsync(grade.Id);
        Assert.NotNull(updated);
        Assert.Equal("Senior Staff", updated.Name);
        Assert.Equal(15, updated.Level);
        Assert.Equal("New desc", updated.Description);
        Assert.Equal("star", updated.Icon);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenGradeNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateGradeCommandHandler(context);

        var result = await handler.Handle(
            new UpdateGradeCommand(Guid.NewGuid(), "Staff", 10, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNameTakenByOtherGrade()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateGradeCommandHandler(context);
        var grade1 = new Grade("Staff", 10, null, null);
        var grade2 = new Grade("Senior", 20, null, null);
        context.Grades.AddRange(grade1, grade2);
        await context.SaveChangesAsync();

        // Try to rename grade2 to grade1's name
        var result = await handler.Handle(
            new UpdateGradeCommand(grade2.Id, "Staff", 20, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_AllowsSelfNameUpdate()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateGradeCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpdateGradeCommand(grade.Id, "Staff", 10, "Updated desc", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }
}
