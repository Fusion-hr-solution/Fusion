using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Commands.ChangeEmployeeManager;

public sealed class ChangeEmployeeManagerCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IWorkforceMutationService? workforceMutationService = null,
    IEmployeeDetailsReadModelService? employeeDetailsReadModelService = null,
    ITenantSettingsReadService? tenantSettingsReadService = null)
    : ICommandHandler<ChangeEmployeeManagerCommand, Result<EmployeeDetailsDto>>
{
    private readonly IWorkforceMutationService workforceMutationService =
        workforceMutationService ?? new WorkforceMutationService(dbContext, tenantContext, new WorkforceCanonicalResolver(dbContext));

    private readonly IEmployeeDetailsReadModelService employeeDetailsReadModelService =
        employeeDetailsReadModelService ?? new EmployeeDetailsReadModelService(
            dbContext,
            new WorkforceCanonicalResolver(dbContext),
            tenantSettingsReadService ?? new TenantSettingsReadService(dbContext));

    public async Task<Result<EmployeeDetailsDto>> Handle(ChangeEmployeeManagerCommand request, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId, cancellationToken);

        if (employee is null)
        {
            throw new EntityNotFoundException("Employee", request.EmployeeId);
        }

        if (employee.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
        }

        var managerResult = await workforceMutationService.ChangeManagerAsync(
            request.EmployeeId,
            new ChangeManagerInput(request.ManagerId, request.EffectiveDate),
            actor: null,
            cancellationToken);
        if (managerResult.IsFailure)
        {
            return Result.Failure<EmployeeDetailsDto>(managerResult.Error);
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("Employee", request.EmployeeId);
        }

        var details = await employeeDetailsReadModelService.BuildAsync(
            employee,
            EmployeeReadAudience.HrAdmin,
            request.EffectiveDate,
            cancellationToken);

        return Result.Success(details);
    }
}
