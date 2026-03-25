using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Interview.Tests.Features.Questions;

public class QuestionServiceTests
{
    [Fact]
    public async Task CreateAsync_WhenQuestionTypeMissing_Throws400ApiException()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new QuestionService(db);

        var request = new CreateQuestionDto
        {
            Type = null!,
            Title = "Valid title",
            Description = "Desc",
            Difficulty = "Easy",
            Points = 10,
            DurationMinutes = 5,
            GradingMethod = "Manual"
        };

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
        Assert.Contains("QuestionType is required", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_WhenMultipleChoiceOptionsNull_ThrowsValidation400()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new QuestionService(db);

        var request = new CreateQuestionDto
        {
            Type = "Multiple Choice",
            Title = "MCQ",
            Description = "Desc",
            Difficulty = "Easy",
            Points = 10,
            DurationMinutes = 5,
            GradingMethod = "Auto-graded",
            Options = null!
        };

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, ex.StatusCode);
        Assert.Contains(ex.Errors, e => e.Contains("require options", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task CreateAsync_WhenValidRequest_PersistsAndSetsUsageCountToZero()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new QuestionService(db);

        var request = new CreateQuestionDto
        {
            Type = "Coding",
            Title = "Two Sum",
            Description = "Implement two sum",
            Difficulty = "Medium",
            Points = 20,
            DurationMinutes = 25,
            GradingMethod = "Hybrid",
            Tags = ["arrays", "hashmap"],
            Language = "C#",
            StarterCode = "public int[] TwoSum(int[] a, int t) { return []; }",
            EvaluationCriteria = "Correctness"
        };

        var created = await service.CreateAsync(request, CancellationToken.None);

        Assert.False(string.IsNullOrWhiteSpace(created.Id));
        Assert.Equal("Coding", created.Type);
        Assert.Equal(0, created.UsageCount);
        Assert.Equal(1, db.Questions.Count());
    }

    [Fact]
    public async Task UpdateAsync_WhenQuestionNotFound_Throws404()
    {
        await using var db = TestDbContextFactory.Create();
        var service = new QuestionService(db);
        var update = new UpdateQuestionDto
        {
            Type = "Multiple Choice",
            Title = "New title",
            Description = "New",
            Difficulty = "Hard",
            Points = 15,
            DurationMinutes = 8,
            GradingMethod = "Auto-graded",
            Tags = ["updated"],
            Options =
            [
                new QuestionOptionDto { Text = "Only option", Correct = true }
            ]
        };

        var ex = await Assert.ThrowsAsync<ApiException>(
            () => service.UpdateAsync(Guid.NewGuid(), update, CancellationToken.None));

        Assert.Equal(StatusCodes.Status404NotFound, ex.StatusCode);
        Assert.Contains("Question not found", ex.Message);
    }

    [Fact]
    public async Task GetAsync_AppliesFilteringSortingAndPaging()
    {
        await using var db = TestDbContextFactory.Create();

        var oldQuestion = new Question
        {
            Title = "SQL basics",
            Description = "Select query",
            Type = QuestionType.Sql,
            Difficulty = Difficulty.Easy,
            GradingMethod = GradingMethod.Hybrid,
            Points = 10,
            DurationMinutes = 5,
            UsageCount = 2
        };
        oldQuestion.SetCreatedAt(DateTime.UtcNow.AddDays(-2));

        var newQuestion = new Question
        {
            Title = "Advanced SQL joins",
            Description = "Join challenge",
            Type = QuestionType.Sql,
            Difficulty = Difficulty.Hard,
            GradingMethod = GradingMethod.Hybrid,
            Points = 25,
            DurationMinutes = 15,
            UsageCount = 5
        };
        newQuestion.SetCreatedAt(DateTime.UtcNow.AddDays(-1));

        var otherType = new Question
        {
            Title = "Design pattern",
            Description = "Explain strategy pattern",
            Type = QuestionType.Design,
            Difficulty = Difficulty.Medium,
            GradingMethod = GradingMethod.Manual,
            Points = 20,
            DurationMinutes = 20,
            UsageCount = 1
        };

        db.Questions.AddRange(oldQuestion, newQuestion, otherType);
        await db.SaveChangesAsync();

        var service = new QuestionService(db);
        var filter = new QuestionFilterDto
        {
            Search = "SQL",
            Types = ["SQL"],
            GradingMethods = ["Hybrid"],
            Sort = "most_used",
            Page = 1,
            PageSize = 1
        };

        var result = await service.GetAsync(filter, CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.TotalPages);
        Assert.Single(result.Items);
        Assert.Equal("Advanced SQL joins", result.Items[0].Title);
    }
}
