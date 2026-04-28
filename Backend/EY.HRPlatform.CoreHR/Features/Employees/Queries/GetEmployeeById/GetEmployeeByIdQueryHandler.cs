using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;

public sealed class GetEmployeeByIdQueryHandler(
    CoreHRDbContext dbContext,
    IEmployeeReadModelPolicy? employeeReadModelPolicy = null) : IQueryHandler<GetEmployeeByIdQuery, Result<EmployeeDto>>
{
    private readonly IEmployeeReadModelPolicy employeeReadModelPolicy = employeeReadModelPolicy ?? new EmployeeReadModelPolicy();

    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .Include(e => e.Manager)
            .Include(e => e.OrgUnit)
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            return Result.Failure<EmployeeDto>(Error.NotFound("Employee", request.EmployeeId));
        }

        var settings = await GetReadSettingsAsync(cancellationToken);
        return Result.Success(employeeReadModelPolicy.MapDetail(employee, settings, EmployeeReadAudience.HrAdmin));
    }

    private async Task<Features.TenantSettings.Dtos.TenantSettingsDto> GetReadSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
    }
}
