using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.TestQuestions;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Interview.Tests.Features.TestQuestions;

public class TestQuestionServiceTests
{
    [Fact]
    public async Task AddQuestionAsync_WhenDuplicateMapping_Throws409()
    {
        await using var db = TestDbContextFactory.Create();

        var test = new Test
        {
            Title = "Engineering Test",
            Description = "Desc",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Draft,
            CandidateCount = 0
        };

        var question = new Question
        {
            Title = "SQL Question",
            Description = "Desc",
            Type = QuestionType.Sql,
            Difficulty = Difficulty.Medium,
            GradingMethod = GradingMethod.Hybrid,
            Points = 20,
            DurationMinutes = 10,
            UsageCount = 0,
            Language = "SQL"
        };

        db.Tests.Add(test);
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        db.TestQuestions.Add(new TestQuestion { TestId = test.Id, QuestionId = question.Id });
        await db.SaveChangesAsync();

        var service = new TestQuestionService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.AddQuestionAsync(test.Id, question.Id, CancellationToken.None));

        Assert.Equal(StatusCodes.Status409Conflict, ex.StatusCode);
        Assert.Contains("already mapped", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RemoveQuestionAsync_WhenMappingMissing_Throws404()
    {
        await using var db = TestDbContextFactory.Create();

        var service = new TestQuestionService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.RemoveQuestionAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, ex.StatusCode);
        Assert.Contains("mapping not found", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetQuestionsAsync_ReturnsMappedQuestionsWithFrontendShape()
    {
        await using var db = TestDbContextFactory.Create();

        var test = new Test
        {
            Title = "Backend Test",
            Description = "Desc",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0
        };

        var question = new Question
        {
            Title = "MCQ",
            Description = "Desc",
            Type = QuestionType.MultipleChoice,
            Difficulty = Difficulty.Easy,
            GradingMethod = GradingMethod.AutoGraded,
            Points = 10,
            DurationMinutes = 5,
            Tags = ["tag1"],
            UsageCount = 7,
            Language = "",
            StarterCode = "",
            EvaluationCriteria = "Correct option"
        };

        question.Options =
        [
            new QuestionOption { Text = "A", Correct = true, QuestionId = question.Id },
            new QuestionOption { Text = "B", Correct = false, QuestionId = question.Id }
        ];

        db.Tests.Add(test);
        db.Questions.Add(question);
        await db.SaveChangesAsync();

        db.TestQuestions.Add(new TestQuestion { TestId = test.Id, QuestionId = question.Id });
        await db.SaveChangesAsync();

        var service = new TestQuestionService(db);

        var result = await service.GetQuestionsAsync(test.Id, CancellationToken.None);

        Assert.Single(result);
        var item = result[0];
        Assert.Equal(question.Id.ToString(), item.Id);
        Assert.Equal("Multiple Choice", item.Type);
        Assert.Equal("Auto-graded", item.GradingMethod);
        Assert.Equal(2, item.Options.Count);
        Assert.Equal("Correct option", item.EvaluationCriteria);
    }
}
