using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Cursus.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Tests.Handlers.Cursus;

public class GetMyCursusQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsFailure_WhenNoProfile()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);

        var result = await handler.Handle(
            new GetMyCursusQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenProfileIncomplete()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var employeeId = Guid.NewGuid();
        context.EmployeeProfiles.Add(new EmployeeProfile(employeeId, null, null));
        await context.SaveChangesAsync();

        var result = await handler.Handle(
            new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Incomplete", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ReturnsMappingsForEmployeeGradeAndServiceLine()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var (employeeId, grade, sl, category) = await SeedBaseDataAsync(context);

        var training = new TrainingCourse("T1", "Desc", 10, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.Add(training);
        await context.SaveChangesAsync();

        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, training.Id, true, 0));
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal("T1", result.Value.Items[0].TrainingTitle);
        Assert.True(result.Value.Items[0].IsRequired);
        Assert.False(result.Value.Items[0].IsFromSharedServiceLine);
    }

    [Fact]
    public async Task Handle_IncludesMappingsFromSharedServiceLine()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var (employeeId, grade, sl, category) = await SeedBaseDataAsync(context);

        var sharedSl = new ServiceLine("Shared SL", "SHR", "#FFF", null, true);
        context.ServiceLines.Add(sharedSl);
        await context.SaveChangesAsync();

        var t1 = new TrainingCourse("Own SL Training", null, 5, false, BadgeLevel.Bronze, category.Id);
        var t2 = new TrainingCourse("Shared Training", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.AddRange(t1, t2);
        await context.SaveChangesAsync();

        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t1.Id, true, 0));
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sharedSl.Id, t2.Id, true, 0));
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Items.Count);

        var sharedItem = result.Value.Items.First(i => i.TrainingTitle == "Shared Training");
        Assert.True(sharedItem.IsFromSharedServiceLine);

        var ownItem = result.Value.Items.First(i => i.TrainingTitle == "Own SL Training");
        Assert.False(ownItem.IsFromSharedServiceLine);
    }

    [Fact]
    public async Task Handle_ExcludesMappingsFromOtherServiceLines()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var (employeeId, grade, sl, category) = await SeedBaseDataAsync(context);

        var otherSl = new ServiceLine("Other SL", "OTH", "#000", null, false);
        context.ServiceLines.Add(otherSl);
        await context.SaveChangesAsync();

        var t1 = new TrainingCourse("Own", null, 5, false, BadgeLevel.Bronze, category.Id);
        var t2 = new TrainingCourse("Other", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.AddRange(t1, t2);
        await context.SaveChangesAsync();

        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t1.Id, true, 0));
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, otherSl.Id, t2.Id, true, 0));
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.Items);
        Assert.Equal("Own", result.Value.Items[0].TrainingTitle);
    }

    [Fact]
    public async Task Handle_ReflectsProgressCorrectly()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var (employeeId, grade, sl, category) = await SeedBaseDataAsync(context);

        var t1 = new TrainingCourse("Completed", null, 10, true, BadgeLevel.Gold, category.Id);
        var t2 = new TrainingCourse("InProgress", null, 5, false, BadgeLevel.Bronze, category.Id);
        var t3 = new TrainingCourse("NotStarted", null, 3, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.AddRange(t1, t2, t3);
        await context.SaveChangesAsync();

        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t1.Id, true, 0));
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t2.Id, false, 1));
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t3.Id, false, 2));
        await context.SaveChangesAsync();

        var p1 = new TrainingProgress(employeeId, t1.Id);
        p1.Complete();
        var p2 = new TrainingProgress(employeeId, t2.Id);
        p2.Start();
        p2.UpdateProgress(50);
        context.TrainingProgress.AddRange(p1, p2);
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Items.Count);

        var summary = result.Value.Summary;
        Assert.Equal(3, summary.TotalCount);
        Assert.Equal(1, summary.CompletedCount);
        Assert.Equal(1, summary.InProgressCount);
        Assert.Equal(1, summary.NotStartedCount);
        Assert.Equal(10, summary.RequiredCreditsTotal); // only t1 is required
        Assert.Equal(10, summary.RequiredCreditsEarned); // t1 is completed
    }

    [Fact]
    public async Task Handle_SortsRequiredFirst_ThenByOrderIndex()
    {
        await using var context = TestDbContextFactory.Create();
        var handler = new GetMyCursusQueryHandler(context);
        var (employeeId, grade, sl, category) = await SeedBaseDataAsync(context);

        var t1 = new TrainingCourse("Optional1", null, 5, false, BadgeLevel.Bronze, category.Id);
        var t2 = new TrainingCourse("Required1", null, 5, false, BadgeLevel.Bronze, category.Id);
        context.Trainings.AddRange(t1, t2);
        await context.SaveChangesAsync();

        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t1.Id, false, 0));
        context.CurriculumMappings.Add(new CurriculumMapping(grade.Id, sl.Id, t2.Id, true, 1));
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetMyCursusQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Required1", result.Value.Items[0].TrainingTitle);
        Assert.Equal("Optional1", result.Value.Items[1].TrainingTitle);
    }

    private static async Task<(Guid employeeId, Grade grade, ServiceLine sl, TrainingCategory category)>
        SeedBaseDataAsync(Infrastructure.Persistence.TrainingDbContext context)
    {
        var grade = new Grade("Staff", 10, null, null);
        var sl = new ServiceLine("Assurance", "ASR", "#3B82F6", null, false);
        var category = new TrainingCategory("Tech", null);
        context.Grades.Add(grade);
        context.ServiceLines.Add(sl);
        context.Categories.Add(category);
        await context.SaveChangesAsync();

        var employeeId = Guid.NewGuid();
        context.EmployeeProfiles.Add(new EmployeeProfile(employeeId, grade.Id, sl.Id));
        await context.SaveChangesAsync();

        return (employeeId, grade, sl, category);
    }
}
