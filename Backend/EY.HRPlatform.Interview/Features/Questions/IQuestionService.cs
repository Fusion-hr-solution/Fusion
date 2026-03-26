using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Questions;

namespace EY.HRPlatform.Interview.Features.Questions;

public interface IQuestionService
{
    Task<PagedResultDto<QuestionDto>> GetAsync(QuestionFilterDto filter, CancellationToken cancellationToken);
    Task<QuestionDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<QuestionDto> CreateAsync(CreateQuestionDto request, CancellationToken cancellationToken);
    Task<QuestionDto> UpdateAsync(Guid id, UpdateQuestionDto request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
