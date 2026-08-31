using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.Membership;

public interface ICustomerContextResolver
{
    Task<CustomerContextResult> ResolveAsync(ApplicationUser user, CancellationToken cancellationToken = default);
}

/// <summary>
/// Derives customer-workspace authority from tenant membership, and from nothing
/// else. Exactly one Active membership produces authority; zero or several
/// produce none, so a corrupted membership set fails closed rather than
/// silently selecting a tenant. This MVP has no membership selector and no
/// tenant switching, so there is deliberately no "choose one" path.
/// </summary>
public sealed class CustomerContextResolver(
    AppIdentityDbContext dbContext,
    UserManager<ApplicationUser> userManager) : ICustomerContextResolver
{
    public async Task<CustomerContextResult> ResolveAsync(
        ApplicationUser user,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(user);

        // Platform Administrator authority is control-plane only. It never
        // becomes customer authority, even if a membership somehow existed.
        if (await userManager.IsInRoleAsync(user, PlatformRole.PlatformAdmin))
        {
            return CustomerContextResult.Denied(CustomerContextDenial.PlatformAdministrator);
        }

        var activeMemberships = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .Where(membership => membership.UserId == user.Id
                && membership.Status == TenantMembershipStatus.Active)
            .Select(membership => new { membership.Id, membership.TenantId, membership.EmployeeId, membership.AccessRevision })
            .Take(2) // Two is enough to prove the set is not exactly one.
            .ToListAsync(cancellationToken);

        if (activeMemberships.Count == 0)
        {
            return CustomerContextResult.Denied(CustomerContextDenial.NoActiveMembership);
        }

        if (activeMemberships.Count > 1)
        {
            return CustomerContextResult.Denied(CustomerContextDenial.MultipleActiveMemberships);
        }

        var membership = activeMemberships[0];

        var modules = await dbContext.TenantModuleEntitlements
            .IgnoreQueryFilters()
            .Where(entitlement => entitlement.TenantId == membership.TenantId)
            .Select(entitlement => entitlement.Module)
            .ToListAsync(cancellationToken);

        return CustomerContextResult.Authoritative(
            new CustomerContext(membership.TenantId, membership.Id, membership.EmployeeId, modules, membership.AccessRevision));
    }
}
