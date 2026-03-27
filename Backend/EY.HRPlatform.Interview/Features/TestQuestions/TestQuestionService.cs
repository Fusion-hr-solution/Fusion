using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.TestQuestions;

public class TestQuestionService(AppDbContext dbContext) : ITestQuestionService
{
    public async Task<IReadOnlyList<QuestionDto>> GetQuestionsAsync(Guid testId, CancellationToken cancellationToken)
    {
        await EnsureTestExists(testId, cancellationToken);

        var items = await dbContext.Questions
            .AsNoTracking()
            .Include(q => q.Options)
            .Where(q => dbContext.TestQuestions.Any(tq => tq.TestId == testId && tq.QuestionId == q.Id))
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync(cancellationToken);

        return items.Select(MapQuestion).ToList();
    }

    public async Task AddQuestionAsync(Guid testId, Guid questionId, CancellationToken cancellationToken)
    {
        await EnsureTestExists(testId, cancellationToken);
        await EnsureQuestionExists(questionId, cancellationToken);

        var alreadyMapped = await dbContext.TestQuestions
            .AnyAsync(x => x.TestId == testId && x.QuestionId == questionId, cancellationToken);

        if (alreadyMapped)
            throw new ApiException("Question is already mapped to this test.", StatusCodes.Status409Conflict);

        dbContext.TestQuestions.Add(new TestQuestion
        {
            TestId = testId,
            QuestionId = questionId
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveQuestionAsync(Guid testId, Guid questionId, CancellationToken cancellationToken)
    {
        var mapping = await dbContext.TestQuestions
            .FirstOrDefaultAsync(x => x.TestId == testId && x.QuestionId == questionId, cancellationToken);

        if (mapping is null)
            throw new ApiException("Test/question mapping not found.", StatusCodes.Status404NotFound);

        dbContext.TestQuestions.Remove(mapping);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureTestExists(Guid testId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Tests.AnyAsync(x => x.Id == testId, cancellationToken);
        if (!exists)
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);
    }

    private async Task EnsureQuestionExists(Guid questionId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Questions.AnyAsync(x => x.Id == questionId, cancellationToken);
        if (!exists)
            throw new ApiException("Question not found.", StatusCodes.Status404NotFound);
    }

    private static QuestionDto MapQuestion(Question question)
    {
        return new QuestionDto
        {
            Id = question.Id.ToString(),
            Title = question.Title,
            Description = question.Description,
            Type = ToContract(question.Type),
            Difficulty = question.Difficulty.ToString(),
            GradingMethod = ToContract(question.GradingMethod),
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Tags = question.Tags,
            UsageCount = question.UsageCount,
            Options = question.Options
                .Select(o => new QuestionOptionDto
                {
                    Text = o.Text,
                    Correct = o.Correct
                }).ToList(),
            Language = question.Language ?? string.Empty,
            StarterCode = question.StarterCode ?? string.Empty,
            EvaluationCriteria = question.EvaluationCriteria ?? string.Empty
        };
    }

    private static string ToContract(QuestionType type)
    {
        return type switch
        {
            QuestionType.Sql => "SQL",
            QuestionType.MultipleChoice => "Multiple Choice",
            QuestionType.CaseStudy => "Case Study",
            QuestionType.TrueFalse => "True/False",
            _ => type.ToString()
        };
    }

    private static string ToContract(GradingMethod method)
    {
        return method switch
        {
            GradingMethod.AutoGraded => "Auto-graded",
            _ => method.ToString()
        };
    }
}
