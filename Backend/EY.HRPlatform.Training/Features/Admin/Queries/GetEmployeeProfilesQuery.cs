using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetEmployeeProfilesQuery(
    int Page = 1,
    int PageSize = 20) : IQuery<Result<PagedResponse<EmployeeProfileDto>>>;
