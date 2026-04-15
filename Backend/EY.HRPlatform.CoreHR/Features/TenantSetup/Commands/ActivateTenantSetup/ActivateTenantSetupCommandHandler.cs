using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ActivateTenantSetup;

public sealed class ActivateTenantSetupCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IIdentityTenantStatusReader tenantStatusReader) : ICommandHandler<ActivateTenantSetupCommand, Result<TenantSetupStateDto>>
{
    public async Task<Result<TenantSetupStateDto>> Handle(
        ActivateTenantSetupCommand request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates.FirstOrDefaultAsync(cancellationToken);
        if (state is not null)
            return Result.Success(TenantSetupStateMapper.Map(state));

        var tenantStatus = await tenantStatusReader.GetCurrentTenantStatusAsync(cancellationToken);
        if (!tenantStatus.IsActive || tenantStatus.IsArchived)
        {
            throw new InvalidTenantActivationStateException(
                "Setup cannot be activated for a suspended or archived tenant.");
        }

        state = TenantSetupState.CreateActivated(tenantContext.TenantId);
        dbContext.TenantSetupStates.Add(state);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            var existingState = await dbContext.TenantSetupStates.FirstAsync(cancellationToken);
            return Result.Success(TenantSetupStateMapper.Map(existingState));
        }

        return Result.Success(TenantSetupStateMapper.Map(state));
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }
}