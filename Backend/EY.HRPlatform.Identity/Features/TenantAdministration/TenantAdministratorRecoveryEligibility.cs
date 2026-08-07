using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantAdministration;

/// <summary>
/// The authoritative Platform-recovery eligibility predicate.
/// Bootstrap remediation remains authoritative until initial activation completes.
/// </summary>
public static class TenantAdministratorRecoveryEligibility
{
    public static async Task<bool> IsEligibleAsync(
        AppIdentityDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var established = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(tenant => tenant.Id == tenantId
                && tenant.IsActive
                && !tenant.IsArchived
                && tenant.AdministratorActivationStatus == TenantAdministratorActivationStatus.Active,
                cancellationToken);

        return established
            && await UsableTenantAdministrator.CountAsync(dbContext, tenantId, cancellationToken) == 0;
    }
}
