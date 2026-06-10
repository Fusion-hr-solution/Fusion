using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfile;

public sealed class GetEmployeeProfileQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy employeeReadModelPolicy,
    IEmployeeReadScopeService employeeReadScopeService,
    ITenantSettingsReadService tenantSettingsReadService) : IQueryHandler<GetEmployeeProfileQuery, Result<EmployeeProfileDto>>
{
    public async Task<Result<EmployeeProfileDto>> Handle(GetEmployeeProfileQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .Include(e => e.Manager)
            .Include(e => e.OrgUnit)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeProfileDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        if (!employeeReadScopeService.CanAccessEmployee(employee, request.Audience, request.RequesterEmployeeId))
        {
            return Result.Failure<EmployeeProfileDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        var directReportCount = await dbContext.Employees
            .CountAsync(e => e.ManagerId == employee.Id && e.Status == EmployeeStatus.Active, cancellationToken);

        var settings = await tenantSettingsReadService.GetCurrentAsync(cancellationToken);

        return Result.Success(employeeReadModelPolicy.MapProfile(employee, settings, request.Audience, directReportCount));
    }
}
