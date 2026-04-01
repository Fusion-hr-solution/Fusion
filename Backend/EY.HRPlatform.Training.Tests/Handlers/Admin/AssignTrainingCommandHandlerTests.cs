using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class AssignTrainingCommandHandlerTests
{
    [Fact]
    public async Task Handle_AssignsTraining_WhenValidData()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AssignTrainingCommandHandler(context);
        var training = context.Trainings.First();
        var employeeId = Guid.NewGuid();

        var command = new AssignTrainingCommand(training.Id, employeeId, null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var assignment = await context.Assignments.FindAsync(result.Value);
        Assert.NotNull(assignment);
        Assert.Equal(training.Id, assignment.TrainingId);
        Assert.Equal(employeeId, assignment.EmployeeId);
        Assert.Equal(AssignmentType.HrAssigned, assignment.AssignmentType);
        Assert.Null(assignment.DueDate);
    }

    [Fact]
    public async Task Handle_AssignsTraining_WithDueDate()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AssignTrainingCommandHandler(context);
        var training = context.Trainings.First();
        var dueDate = new DateTime(2025, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var command = new AssignTrainingCommand(training.Id, Guid.NewGuid(), dueDate);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        var assignment = await context.Assignments.FindAsync(result.Value);
        Assert.NotNull(assignment);
        Assert.NotNull(assignment.DueDate);
        Assert.Equal(DateTimeKind.Utc, assignment.DueDate.Value.Kind);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AssignTrainingCommandHandler(context);

        var command = new AssignTrainingCommand(Guid.NewGuid(), Guid.NewGuid(), null);
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateAssignment()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new AssignTrainingCommandHandler(context);
        var training = context.Trainings.First();
        var employeeId = Guid.NewGuid();

        // First assignment
        var command = new AssignTrainingCommand(training.Id, employeeId, null);
        await handler.Handle(command, CancellationToken.None);

        // Duplicate assignment
        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }
}
