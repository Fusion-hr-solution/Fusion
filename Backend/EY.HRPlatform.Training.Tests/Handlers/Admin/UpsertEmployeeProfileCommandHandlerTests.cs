using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpsertEmployeeProfileCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesProfile_WhenNoneExists()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpsertEmployeeProfileCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var employeeId = Guid.NewGuid();
        var result = await handler.Handle(
            new UpsertEmployeeProfileCommand(employeeId, grade.Id, sl.Id),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var profile = context.EmployeeProfiles.FirstOrDefault(p => p.EmployeeId == employeeId);
        Assert.NotNull(profile);
        Assert.Equal(grade.Id, profile.GradeId);
        Assert.Equal(sl.Id, profile.ServiceLineId);
    }

    [Fact]
    public async Task Handle_UpdatesProfile_WhenAlreadyExists()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpsertEmployeeProfileCommandHandler(context);
        var grade1 = new Grade("Staff", 10, null, null);
        var grade2 = new Grade("Senior", 20, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.Grades.AddRange(grade1, grade2);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var employeeId = Guid.NewGuid();
        var existingProfile = new EmployeeProfile(employeeId, grade1.Id, sl.Id);
        context.EmployeeProfiles.Add(existingProfile);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpsertEmployeeProfileCommand(employeeId, grade2.Id, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var profile = context.EmployeeProfiles.FirstOrDefault(p => p.EmployeeId == employeeId);
        Assert.NotNull(profile);
        Assert.Equal(grade2.Id, profile.GradeId);
        Assert.Null(profile.ServiceLineId);
    }

    [Fact]
    public async Task Handle_AllowsNullGradeAndServiceLine()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpsertEmployeeProfileCommandHandler(context);

        var employeeId = Guid.NewGuid();
        var result = await handler.Handle(
            new UpsertEmployeeProfileCommand(employeeId, null, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var profile = context.EmployeeProfiles.FirstOrDefault(p => p.EmployeeId == employeeId);
        Assert.NotNull(profile);
        Assert.Null(profile.GradeId);
        Assert.Null(profile.ServiceLineId);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenGradeNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpsertEmployeeProfileCommandHandler(context);

        var result = await handler.Handle(
            new UpsertEmployeeProfileCommand(Guid.NewGuid(), Guid.NewGuid(), null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenServiceLineNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpsertEmployeeProfileCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpsertEmployeeProfileCommand(Guid.NewGuid(), grade.Id, Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
