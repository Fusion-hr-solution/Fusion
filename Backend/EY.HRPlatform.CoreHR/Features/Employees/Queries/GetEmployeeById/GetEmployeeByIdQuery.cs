using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;

/// <summary>
/// Query to retrieve a single employee by ID, including manager information.
/// </summary>
public sealed record GetEmployeeByIdQuery(Guid EmployeeId) : IQuery<Result<EmployeeDetailsDto>>;
