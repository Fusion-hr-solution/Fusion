using System;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeByKey;

public sealed class GetEmployeeByKeyQueryHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeeDetailsReadModelService employeeDetailsReadModelService) : IQueryHandler<GetEmployeeByKeyQuery, Result<EmployeeDetailsDto>>
{
    public async Task<Result<EmployeeDetailsDto>> Handle(GetEmployeeByKeyQuery request, CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;

        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.StableEmployeeKey == request.EmployeeKey && e.TenantId == tenantId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDetailsDto>(Error.NotFound("Employee", Guid.Empty));
        }

        return Result.Success(await employeeDetailsReadModelService.BuildAsync(
            employee,
            EmployeeReadAudience.HrAdmin,
            null,
            cancellationToken));
    }
}
