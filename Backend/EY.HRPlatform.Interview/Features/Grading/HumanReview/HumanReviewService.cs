using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Grading.HumanReview;

public class HumanReviewService(AppDbContext dbContext)
{
    public async Task<IReadOnlyList<ReviewQueueItemDto>> GetPendingReviewsAsync(CancellationToken ct)
    {
        var results = await dbContext.QuestionGradeResults
            .Include(r => r.Attempt)
            .Include(r => r.Question)
            .Where(r => r.NeedsHumanReview && r.ReviewedAt == null)
            .OrderBy(r => r.Attempt.SubmittedAtUtc)
            .ToListAsync(ct);

        return results.Select(r =>
        {
            var answer = ParseAnswer(r.Attempt.AnswersJson, r.QuestionId.ToString());
            return new ReviewQueueItemDto(
                ResultId: r.Id,
                AttemptId: r.AttemptId,
                CandidateName: r.Attempt.CandidateName ?? r.Attempt.CandidateEmail,
                QuestionTitle: r.Question.Title,
                QuestionText: r.Question.Description,
                CandidateAnswer: answer,
                AiSuggestedFeedback: r.Feedback,
                AiSuggestedScore: r.Score,
                MaxScore: r.MaxScore
            );
        }).ToList();
    }

    public async Task ApproveAsync(Guid resultId, decimal overrideScore, string reviewerEmail, CancellationToken ct)
    {
        var result = await dbContext.QuestionGradeResults
            .FirstOrDefaultAsync(r => r.Id == resultId, ct)
            ?? throw new InvalidOperationException($"Grade result {resultId} not found.");

        result.Score = Math.Clamp(overrideScore, 0m, result.MaxScore);
        result.NeedsHumanReview = false;
        result.ReviewedAt = DateTime.UtcNow;
        result.ReviewedBy = reviewerEmail;

        var attempt = await dbContext.CandidateTestAttempts
            .FirstOrDefaultAsync(a => a.Id == result.AttemptId, ct)
            ?? throw new InvalidOperationException($"Attempt {result.AttemptId} not found.");

        var allResults = await dbContext.QuestionGradeResults
            .Where(r => r.AttemptId == result.AttemptId)
            .ToListAsync(ct);

        attempt.TotalScore = allResults.Sum(r => r.Id == result.Id ? result.Score : r.Score);

        var anyPending = allResults.Any(r => r.Id != result.Id && r.NeedsHumanReview && r.ReviewedAt == null);
        if (!anyPending)
            attempt.GradingStatus = GradingStatus.Completed;

        await dbContext.SaveChangesAsync(ct);
    }

    private static string ParseAnswer(string answersJson, string questionId)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(answersJson);
            return dict?.TryGetValue(questionId, out var v) == true ? v : string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }
}
