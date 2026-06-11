using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
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
                .ThenInclude(q => q.Options)
            .Where(r => r.NeedsHumanReview && r.ReviewedAt == null)
            .OrderBy(r => r.Attempt.SubmittedAtUtc)
            .ToListAsync(ct);

        // An attempt can have several flagged questions in the queue, and parsing the
        // full AnswersJson resolves every answer at once. Parse each attempt's payload
        // a single time and reuse the map across all of that attempt's rows.
        var answersByAttempt = new Dictionary<Guid, IReadOnlyDictionary<string, CandidateAnswer>>();
        var items = new List<ReviewQueueItemDto>(results.Count);

        foreach (var r in results)
        {
            if (!answersByAttempt.TryGetValue(r.AttemptId, out var answers))
            {
                answers = CandidateAnswerParser.Parse(r.Attempt.AnswersJson);
                answersByAttempt[r.AttemptId] = answers;
            }

            var answer = answers.TryGetValue(r.QuestionId.ToString(), out var parsed)
                ? parsed
                : CandidateAnswer.Empty;

            items.Add(new ReviewQueueItemDto(
                ResultId: r.Id,
                AttemptId: r.AttemptId,
                CandidateName: r.Attempt.CandidateName ?? r.Attempt.CandidateEmail,
                QuestionTitle: r.Question.Title,
                QuestionText: r.Question.Description,
                CandidateAnswer: RenderAnswer(answer, r.Question),
                AiSuggestedFeedback: r.Feedback,
                AiSuggestedScore: r.Score,
                MaxScore: r.MaxScore
            ));
        }

        return items;
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

    /// <summary>
    /// Produces a human-readable answer for the review queue. Selected option ids
    /// are resolved to their option text; otherwise the free-text answer is shown.
    /// </summary>
    private static string RenderAnswer(CandidateAnswer answer, Question question)
    {
        if (answer.SelectedOptionIds.Count > 0)
        {
            var textById = question.Options
                .GroupBy(o => o.Id.ToString(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Text, StringComparer.OrdinalIgnoreCase);

            var labels = answer.SelectedOptionIds
                .Select(id => textById.TryGetValue(id, out var text) ? text : id);

            return string.Join(", ", labels);
        }

        return answer.AnswerText;
    }
}
