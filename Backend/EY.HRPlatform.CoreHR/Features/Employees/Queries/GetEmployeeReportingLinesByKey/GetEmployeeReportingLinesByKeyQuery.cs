using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLinesByKey;

public sealed record GetEmployeeReportingLinesByKeyQuery(
    string EmployeeKey,
    EmployeeReadAudience Audience = EmployeeReadAudience.HrAdmin) : IQuery<Result<EmployeeReportingLinesDto>>;
