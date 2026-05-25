using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Grading.Dtos;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public class DeterministicGrader : IGrader
{
    public bool CanGrade(Question question) =>
        question.Type is QuestionType.MultipleChoice or QuestionType.TrueFalse;

    public Task<QuestionGradeResultDto> GradeAsync(Question question, string answer, CancellationToken ct)
    {
        var correct = question.Options.Any(o => o.Correct && NormalizeAnswer(o.Text) == NormalizeAnswer(answer));
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

    private static string NormalizeAnswer(string value) =>
        value.Trim().ToLowerInvariant();
}
