using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class AddCurriculumMappingCommandHandlerTests
{
    [Fact]
    public async Task Handle_AddsMappingWithAutoOrderIndex()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddCurriculumMappingCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var training = new TrainingCourse("Intro .NET", null, 10, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, training.Id, true, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var mapping = await context.CurriculumMappings.FindAsync(result.Value);
        Assert.NotNull(mapping);
        Assert.Equal(0, mapping.OrderIndex);
        Assert.True(mapping.IsRequired);
    }

    [Fact]
    public async Task Handle_AutoIncrementsOrderIndex()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddCurriculumMappingCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var t1 = new TrainingCourse("T1", null, 5, false, BadgeLevel.Bronze, category.Id);
        var t2 = new TrainingCourse("T2", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.AddRange(t1, t2);
        await context.SaveChangesAsync();

        await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, t1.Id, true, null),
            CancellationToken.None);

        var result = await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, t2.Id, false, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var mapping = await context.CurriculumMappings.FindAsync(result.Value);
        Assert.NotNull(mapping);
        Assert.Equal(1, mapping.OrderIndex);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicate()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddCurriculumMappingCommandHandler(context);
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

        await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, training.Id, true, null),
            CancellationToken.None);

        var result = await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, training.Id, false, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Duplicate", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenGradeNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddCurriculumMappingCommandHandler(context);

        var result = await handler.Handle(
            new AddCurriculumMappingCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), true, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new AddCurriculumMappingCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new AddCurriculumMappingCommand(grade.Id, sl.Id, Guid.NewGuid(), true, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
