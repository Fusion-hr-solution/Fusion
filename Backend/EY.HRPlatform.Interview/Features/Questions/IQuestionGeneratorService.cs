using EY.HRPlatform.Interview.Models.Questions;

namespace EY.HRPlatform.Interview.Features.Questions;

public interface IQuestionGeneratorService
{
    /// <summary>
    /// Drafts one or more questions with the AI model. Returns unsaved
    /// <see cref="CreateQuestionDto"/> drafts for the author to review and save —
    /// nothing is persisted here.
    /// </summary>
    Task<IReadOnlyList<CreateQuestionDto>> GenerateAsync(
        GenerateQuestionsRequestDto request, CancellationToken cancellationToken);
}
