using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.MyTrainings;

public class EnrollCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesAssignment_WhenValidRequest()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        var employeeId = Guid.NewGuid();

        var handler = new EnrollCommandHandler(context);
        var command = new EnrollCommand(employeeId, training.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);

        var assignment = context.Assignments.FirstOrDefault(a => a.Id == result.Value);
        Assert.NotNull(assignment);
        Assert.Equal(employeeId, assignment.EmployeeId);
        Assert.Equal(training.Id, assignment.TrainingId);
        Assert.Equal(AssignmentType.SelfEnroll, assignment.AssignmentType);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        var employeeId = Guid.NewGuid();
        var nonExistentTrainingId = Guid.NewGuid();

        var handler = new EnrollCommandHandler(context);
        var command = new EnrollCommand(employeeId, nonExistentTrainingId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Training.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenAlreadyEnrolled()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        var employeeId = Guid.NewGuid();

        // First enrollment
        var existingAssignment = new TrainingAssignment(training.Id, employeeId, AssignmentType.SelfEnroll);
        context.Assignments.Add(existingAssignment);
        await context.SaveChangesAsync();

        var handler = new EnrollCommandHandler(context);
        var command = new EnrollCommand(employeeId, training.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Enrollment.Conflict", result.Error.Code);
    }

    [Fact]
    public async Task Handle_AllowsSameTrainingForDifferentEmployees()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();
        var employee1 = Guid.NewGuid();
        var employee2 = Guid.NewGuid();

        var handler = new EnrollCommandHandler(context);

        // Act
        var result1 = await handler.Handle(new EnrollCommand(employee1, training.Id), CancellationToken.None);
        var result2 = await handler.Handle(new EnrollCommand(employee2, training.Id), CancellationToken.None);

        // Assert
        Assert.True(result1.IsSuccess);
        Assert.True(result2.IsSuccess);
        Assert.NotEqual(result1.Value, result2.Value);
    }

    [Fact]
    public async Task Handle_AllowsSameEmployeeForDifferentTrainings()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var trainings = context.Trainings.ToList();
        var employeeId = Guid.NewGuid();

        var handler = new EnrollCommandHandler(context);

        // Act
        var result1 = await handler.Handle(new EnrollCommand(employeeId, trainings[0].Id), CancellationToken.None);
        var result2 = await handler.Handle(new EnrollCommand(employeeId, trainings[1].Id), CancellationToken.None);

        // Assert
        Assert.True(result1.IsSuccess);
        Assert.True(result2.IsSuccess);
    }
}
