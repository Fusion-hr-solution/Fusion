using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;

public sealed record GetEmployeeOrgChartQuery(
    Guid? RootEmployeeId = null,
    int MaxDepth = 10,
    bool IncludeInactive = false) : IQuery<Result<EmployeeOrgChartDto>>;