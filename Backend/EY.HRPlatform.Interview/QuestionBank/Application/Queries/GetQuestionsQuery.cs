using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Models.Responses;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Queries;

public record GetQuestionsQuery(
    int Page,
    int PageSize,
    string? Search = null,
    string[]? Types = null,
    string[]? Difficulties = null,
    string? SortBy = null
) : IQuery<PaginatedResponse<QuestionDto>>;