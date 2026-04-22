using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin;

public class ReorderCurriculumCellCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReordersCorrectly()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new ReorderCurriculumCellCommandHandler(context);
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

        var m1 = new CurriculumMapping(grade.Id, sl.Id, t1.Id, true, 0);
        var m2 = new CurriculumMapping(grade.Id, sl.Id, t2.Id, true, 1);
        context.CurriculumMappings.AddRange(m1, m2);
        await context.SaveChangesAsync();

        // Reverse order
        var result = await handler.Handle(
            new ReorderCurriculumCellCommand(grade.Id, sl.Id, [m2.Id, m1.Id]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updated1 = await context.CurriculumMappings.FindAsync(m1.Id);
        var updated2 = await context.CurriculumMappings.FindAsync(m2.Id);
        Assert.Equal(1, updated1!.OrderIndex);
        Assert.Equal(0, updated2!.OrderIndex);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenDuplicateIds()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new ReorderCurriculumCellCommandHandler(context);
        var id = Guid.NewGuid();

        var result = await handler.Handle(
            new ReorderCurriculumCellCommand(Guid.NewGuid(), Guid.NewGuid(), [id, id]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("DuplicateIds", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenEmptyList()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new ReorderCurriculumCellCommandHandler(context);

        var result = await handler.Handle(
            new ReorderCurriculumCellCommand(Guid.NewGuid(), Guid.NewGuid(), []),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("EmptyReorderList", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenCountMismatch()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new ReorderCurriculumCellCommandHandler(context);
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var t1 = new TrainingCourse("T1", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(t1);
        await context.SaveChangesAsync();

        var m1 = new CurriculumMapping(grade.Id, sl.Id, t1.Id, true, 0);
        context.CurriculumMappings.Add(m1);
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new ReorderCurriculumCellCommand(grade.Id, sl.Id, [m1.Id, Guid.NewGuid()]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("CountMismatch", result.Error.Code);
    }
}
