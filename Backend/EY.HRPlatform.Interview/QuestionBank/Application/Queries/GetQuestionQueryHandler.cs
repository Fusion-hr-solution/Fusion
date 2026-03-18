using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Infrastructure.Repositories;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;
using MediatR;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Queries;

public class GetQuestionsQueryHandler : IQueryHandler<GetQuestionsQuery, PaginatedResponse<QuestionDto>>
{
    private readonly IQuestionRepository _repository;

    public GetQuestionsQueryHandler(IQuestionRepository repository)
    {
        _repository = repository;
    }

    public async Task<PaginatedResponse<QuestionDto>> Handle(
        GetQuestionsQuery request,
        CancellationToken cancellationToken)
    {
        var (items, total) = await _repository.GetPaginatedAsync(
            request.Page,
            request.PageSize,
            request.Search,
            request.Types,
            request.Difficulties,
            request.SortBy);

        var dtos = items.Select(MapToDto).ToList();

        return new PaginatedResponse<QuestionDto>
        {
            Items = dtos,
            Page = request.Page,
            PageSize = request.PageSize,
            Total = total
        };
    }

    private static QuestionDto MapToDto(Domain.Entities.Question question)
    {
        return new QuestionDto
        {
            Id = question.Id,
            Title = question.Title,
            Description = question.Description,
            Type = question.Type,
            Difficulty = question.Difficulty,
            GradingMethod = question.GradingMethod,
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Tags = question.Tags,
            UsageCount = question.UsageCount,
            IsActive = question.IsActive,
            CreatedAt = question.CreatedAt,
            UpdatedAt = question.UpdatedAt,
            Options = question.Options?.Select(o => new QuestionOptionResponseDto
            {
                Id = o.Id,
                Text = o.Text,
                IsCorrect = o.IsCorrect,
                SortOrder = o.SortOrder
            }).OrderBy(o => o.SortOrder).ToList()
        };
    }
}