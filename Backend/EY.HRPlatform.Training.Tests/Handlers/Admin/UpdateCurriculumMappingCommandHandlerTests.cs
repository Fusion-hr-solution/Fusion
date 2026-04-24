using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class UpdateCurriculumMappingCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesIsRequired()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateCurriculumMappingCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var training = new TrainingCourse("Intro", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        var mapping = new CurriculumMapping(grade.Id, sl.Id, training.Id, true, 0);
        context.CurriculumMappings.Add(mapping);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new UpdateCurriculumMappingCommand(mapping.Id, false), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated = await context.CurriculumMappings.FindAsync(mapping.Id);
        Assert.NotNull(updated);
        Assert.False(updated.IsRequired);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new UpdateCurriculumMappingCommandHandler(context);

        var result = await handler.Handle(
            new UpdateCurriculumMappingCommand(Guid.NewGuid(), false), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
