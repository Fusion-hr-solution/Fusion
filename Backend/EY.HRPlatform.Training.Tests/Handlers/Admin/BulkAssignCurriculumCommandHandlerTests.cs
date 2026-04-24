using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class BulkAssignCurriculumCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesAllCrossProductMappings()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);
        var g1 = new Grade("Staff", 10, null, null);
        var g2 = new Grade("Senior", 20, null, null);
        var sl1 = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var sl2 = new ServiceLine("Consulting", "CON", "#8B5CF6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.AddRange(g1, g2);
        context.ServiceLines.AddRange(sl1, sl2);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var training = new TrainingCourse("Intro", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(training.Id, true, [g1.Id, g2.Id], [sl1.Id, sl2.Id]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(4, result.Value);
        Assert.Equal(4, await context.CurriculumMappings.CountAsync());
    }

    [Fact]
    public async Task Handle_GradesOnly_AssignsToAllServiceLines()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl1 = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var sl2 = new ServiceLine("Consulting", "CON", "#8B5CF6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.AddRange(sl1, sl2);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var training = new TrainingCourse("Intro", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(training.Id, true, [grade.Id], null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value);
    }

    [Fact]
    public async Task Handle_ServiceLinesOnly_AssignsToAllGrades()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);
        var g1 = new Grade("Staff", 10, null, null);
        var g2 = new Grade("Senior", 20, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.AddRange(g1, g2);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var training = new TrainingCourse("Intro", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(training.Id, true, null, [sl.Id]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value);
    }

    [Fact]
    public async Task Handle_SkipsExistingRows_Idempotent()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);
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

        // Pre-add one mapping
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, training.Id, true, 0));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(training.Id, true, [grade.Id], [sl.Id]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value); // skipped existing
        Assert.Equal(1, await context.CurriculumMappings.CountAsync());
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenEmptyScope()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(Guid.NewGuid(), true, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("EmptyScope", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenTrainingNotFound()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new BulkAssignCurriculumCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        context.Grades.Add(grade);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new BulkAssignCurriculumCommand(Guid.NewGuid(), true, [grade.Id], null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}
