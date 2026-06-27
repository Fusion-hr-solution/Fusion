using System;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfileByKey;

public sealed class GetEmployeeProfileByKeyQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeDetailsReadModelService employeeDetailsReadModelService) : IQueryHandler<GetEmployeeProfileByKeyQuery, Result<EmployeeProfileDto>>
{
    public async Task<Result<EmployeeProfileDto>> Handle(GetEmployeeProfileByKeyQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.StableEmployeeKey == request.EmployeeKey, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeProfileDto>(Error.NotFound("Employee", Guid.Empty));
        }

        return Result.Success(await employeeDetailsReadModelService.BuildProfileAsync(
            employee,
            request.Audience,
            null,
            cancellationToken));
    }
}
