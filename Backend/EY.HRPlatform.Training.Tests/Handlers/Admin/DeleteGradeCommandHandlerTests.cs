using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class DeleteGradeCommandHandlerTests
{
    [Fact]
    public async Task Handle_DeletesGrade_WhenNoProfiles()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteGradeCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new DeleteGradeCommand(grade.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await context.Grades.FindAsync(grade.Id));
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenGradeNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteGradeCommandHandler(context);

        var result = await handler.Handle(
            new DeleteGradeCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenGradeHasProfiles()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new DeleteGradeCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var profile = new EmployeeProfile(Guid.NewGuid(), grade.Id, null);
        context.EmployeeProfiles.Add(profile);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new DeleteGradeCommand(grade.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("HasProfiles", result.Error.Code);
    }
}
