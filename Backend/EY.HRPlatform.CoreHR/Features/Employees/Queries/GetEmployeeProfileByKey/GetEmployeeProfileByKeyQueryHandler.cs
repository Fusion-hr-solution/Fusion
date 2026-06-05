using System;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfileByKey;

public sealed class GetEmployeeProfileByKeyQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeProfileByKeyQuery, Result<EmployeeProfileDto>>
{
    public async Task<Result<EmployeeProfileDto>> Handle(GetEmployeeProfileByKeyQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .Include(e => e.Manager)
            .Include(e => e.OrgUnit)
            .FirstOrDefaultAsync(e => e.StableEmployeeKey == request.EmployeeKey, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeProfileDto>(Error.NotFound("Employee", Guid.Empty));
        }

        var directReportCount = await dbContext.Employees
            .CountAsync(e => e.ManagerId == employee.Id && e.Status == EmployeeStatus.Active, cancellationToken);

        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);

        return Result.Success(employeeReadModelPolicy.MapProfile(employee, settings, request.Audience, directReportCount));
    }
}
