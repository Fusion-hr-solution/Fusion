using System;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeByKey;

public sealed class GetEmployeeByKeyQueryHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeByKeyQuery, Result<EmployeeDto>>
{
    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByKeyQuery request, CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;

        var employee = await dbContext.Employees
            .Include(e => e.Manager)
            .Include(e => e.OrgUnit)
            .FirstOrDefaultAsync(e => e.StableEmployeeKey == request.EmployeeKey && e.TenantId == tenantId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDto>(Error.NotFound("Employee", Guid.Empty));
        }

        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);
        return Result.Success(employeeReadModelPolicy.MapDetail(employee, settings, EmployeeReadAudience.HrAdmin));
    }
}
