using EY.HRPlatform.Interview.Models.Questions;

namespace EY.HRPlatform.Interview.Features.TestQuestions;

public interface ITestQuestionService
{
    Task<IReadOnlyList<QuestionDto>> GetQuestionsAsync(Guid testId, CancellationToken cancellationToken);
    Task AddQuestionAsync(Guid testId, Guid questionId, CancellationToken cancellationToken);
    Task RemoveQuestionAsync(Guid testId, Guid questionId, CancellationToken cancellationToken);
}
