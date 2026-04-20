using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Catalog;

public class TrainingDetailFieldsTests
{
    [Fact]
    public async Task GetById_ReturnsMandatoryFlag_WhenTrue()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var mandatory = context.Trainings.First(t => t.IsMandatory);

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(mandatory.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.IsMandatory);
    }

    [Fact]
    public async Task GetById_ReturnsMandatoryFlag_WhenFalse()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var optional = context.Trainings.First(t => !t.IsMandatory);

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(optional.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.IsMandatory);
    }

    [Fact]
    public async Task GetById_ReturnsBadgeLevel()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(training.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(string.IsNullOrEmpty(result.Value!.BadgeLevel));
        Assert.Contains(result.Value.BadgeLevel, new[] { "Bronze", "Silver", "Gold" });
    }

    [Fact]
    public async Task GetById_ReturnsCredits()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(training.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.Credits > 0);
    }

    [Fact]
    public async Task GetById_GoldBadgeLevel_ReturnedCorrectly()
    {
        // Arrange — "Advanced C#" in seed data has Gold badge level
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var goldTraining = context.Trainings.First(t => t.BadgeLevel == BadgeLevel.Gold);

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(goldTraining.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Gold", result.Value!.BadgeLevel);
    }

    [Fact]
    public async Task GetById_BronzeBadgeLevel_ReturnedCorrectly()
    {
        // Arrange — "Introduction to .NET" in seed data has Bronze badge level
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var bronzeTraining = context.Trainings.First(t => t.BadgeLevel == BadgeLevel.Bronze);

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(bronzeTraining.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Bronze", result.Value!.BadgeLevel);
    }

    [Fact]
    public async Task GetAllTrainings_IncludesMandatoryAndCredits()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var handler = new GetAllTrainingsQueryHandler(context);
        var query = new GetAllTrainingsQuery(null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var items = result.Value!.Items;
        Assert.Equal(2, items.Count);

        // Verify the fields exist and have reasonable values
        foreach (var item in items)
        {
            Assert.True(item.Credits > 0);
            Assert.False(string.IsNullOrEmpty(item.BadgeLevel));
        }

        // One should be mandatory, one optional (from seed data)
        Assert.Contains(items, i => i.IsMandatory);
        Assert.Contains(items, i => !i.IsMandatory);
    }

    [Fact]
    public async Task GetById_IncludesExamWithPassingScore()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        var exam = new Exam("Certification Exam", 75, training.Id);
        exam.AddQuestion(new ExamQuestion("Q1?", QuestionType.MultipleChoice, exam.Id, 0));
        exam.AddQuestion(new ExamQuestion("Q2?", QuestionType.TrueFalse, exam.Id, 1));
        context.Exams.Add(exam);
        await context.SaveChangesAsync();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(training.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Exams);
        Assert.Equal(75, result.Value.Exams[0].PassingScore);
        Assert.Equal(2, result.Value.Exams[0].QuestionCount);
        Assert.Equal("Certification Exam", result.Value.Exams[0].Title);
    }
}
