using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.Dtos;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public class DeterministicGrader : IGrader
{
    public bool CanGrade(Question question) =>
        question.Type is QuestionType.MultipleChoice or QuestionType.TrueFalse;

    public Task<QuestionGradeResultDto> GradeAsync(Question question, CandidateAnswer answer, CancellationToken ct)
    {
        var correct = IsCorrect(question, answer);
        var score = correct ? (decimal)question.Points : 0m;

        return Task.FromResult(new QuestionGradeResultDto(
            QuestionId: question.Id,
            GraderType: "Deterministic",
            Score: score,
            MaxScore: question.Points,
            Feedback: null,
            NeedsHumanReview: false
        ));
    }

    private static bool IsCorrect(Question question, CandidateAnswer answer)
    {
        var correctIds = question.Options
            .Where(o => o.Correct)
            .Select(o => o.Id.ToString())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (correctIds.Count == 0)
            return false;

        // Primary path: the candidate selected option ids. Award full credit only
        // when the selected set exactly matches the correct set (handles single- and
        // multi-select, and rejects partial or extra selections).
        var selectedIds = answer.SelectedOptionIds
            .Select(id => id.Trim())
            .Where(id => id.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (selectedIds.Count > 0)
            return selectedIds.SetEquals(correctIds);

        // Fallback: some answers arrive as plain text (e.g. "True"/"False" or the
        // option label). Match against the correct option text.
        if (!string.IsNullOrWhiteSpace(answer.AnswerText))
        {
            var normalized = NormalizeAnswer(answer.AnswerText);
            return question.Options.Any(o => o.Correct && NormalizeAnswer(o.Text) == normalized);
        }

        return false;
    }

    private static string NormalizeAnswer(string value) =>
        value.Trim().ToLowerInvariant();
}
