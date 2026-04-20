using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Catalog.Queries;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Catalog;

public class GetTrainingByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTrainingDetail_WhenFound()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var existingTraining = context.Trainings.First();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(existingTraining.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(existingTraining.Id, result.Value.Id);
        Assert.Equal(existingTraining.Title, result.Value.Title);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenNotFound()
    {
        // Arrange
        await using var context = TestDbContextFactory.Create();
        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Training.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_IncludesChapters()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var trainingWithChapters = context.Trainings.First(t => t.Title.Contains(".NET"));

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(trainingWithChapters.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value!.Chapters);
        Assert.Equal(2, result.Value.Chapters.Count);
    }

    [Fact]
    public async Task Handle_IncludesCategoryInfo()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var existingTraining = context.Trainings.First();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(existingTraining.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value!.CategoryId);
        Assert.Equal("Technical Skills", result.Value.CategoryName);
    }

    [Fact]
    public async Task Handle_ReturnsEmptyExams_WhenNoExams()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var existingTraining = context.Trainings.First();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(existingTraining.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value!.Exams);
        Assert.Empty(result.Value.Exams);
    }

    [Fact]
    public async Task Handle_IncludesExams_WhenPresent()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = context.Trainings.First();

        // Add an exam
        var exam = new Exam("Final Exam", 80, training.Id);
        var question = new ExamQuestion("What is C#?", QuestionType.MultipleChoice, exam.Id, 0);
        exam.AddQuestion(question);
        context.Exams.Add(exam);
        await context.SaveChangesAsync();

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(training.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Exams);
        Assert.Equal("Final Exam", result.Value.Exams[0].Title);
        Assert.Equal(80, result.Value.Exams[0].PassingScore);
        Assert.Equal(1, result.Value.Exams[0].QuestionCount);
    }

    [Fact]
    public async Task Handle_ReturnsOrderedChapters()
    {
        // Arrange
        await using var context = await TestDbContextFactory.CreateWithSeedDataAsync();
        var trainingWithChapters = context.Trainings.First(t => t.Title.Contains(".NET"));

        var handler = new GetTrainingByIdQueryHandler(context);
        var query = new GetTrainingByIdQuery(trainingWithChapters.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var chapters = result.Value!.Chapters;
        for (int i = 1; i < chapters.Count; i++)
        {
            Assert.True(chapters[i].OrderIndex >= chapters[i - 1].OrderIndex);
        }
    }
}
