using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetWorkforceReadinessSummary;

public sealed record GetWorkforceReadinessSummaryQuery()
    : IQuery<Result<WorkforceReadinessSummaryDto>>;