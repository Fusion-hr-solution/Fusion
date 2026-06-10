using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfile;

public sealed record GetEmployeeProfileQuery(
	Guid EmployeeId,
	EmployeeReadAudience Audience = EmployeeReadAudience.HrAdmin,
	Guid? RequesterEmployeeId = null) : IQuery<Result<EmployeeProfileDto>>;
