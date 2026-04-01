using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class GetTrainingAssignmentsQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAssignments_WhenTrainingExists()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        // Add two assignments
        var assignment1 = new TrainingAssignment(training.Id, Guid.NewGuid(), AssignmentType.HrAssigned, null);
        var assignment2 = new TrainingAssignment(training.Id, Guid.NewGuid(), AssignmentType.HrAssigned,
            DateTime.UtcNow.AddDays(30));
        context.Assignments.AddRange(assignment1, assignment2);
        await context.SaveChangesAsync();

        var handler = new GetTrainingAssignmentsQueryHandler(context);
        var query = new GetTrainingAssignmentsQuery(training.Id);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Count);
        Assert.All(result.Value, a => Assert.Equal(training.Id, a.TrainingId));
    }

    [Fact]
    public async Task Handle_ReturnsEmptyList_WhenNoAssignments()
    {
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        var handler = new GetTrainingAssignmentsQueryHandler(context);
        var query = new GetTrainingAssignmentsQuery(training.Id);
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetTrainingAssignmentsQueryHandler(context);

        var query = new GetTrainingAssignmentsQuery(Guid.NewGuid());
        var result = await handler.Handle(query, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
