using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;

public sealed record GetEmployeeReportingLinesQuery(
	Guid EmployeeId,
	EmployeeReadAudience Audience = EmployeeReadAudience.HrAdmin,
	Guid? RequesterEmployeeId = null) : IQuery<Result<EmployeeReportingLinesDto>>;