using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetAdminTrainingsQuery(
    Guid? CategoryId,
    string? Search,
    bool IncludeDeleted,
    int Page,
    int PageSize) : IQuery<Result<PagedResponse<AdminTrainingDto>>>;
