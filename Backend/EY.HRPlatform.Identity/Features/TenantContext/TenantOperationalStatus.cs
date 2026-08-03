using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Features.TenantContext;

/// <summary>
/// The tenant lifecycle as the tenant-context surfaces report it.
///
/// It is read from the tenant's own recorded state. It was previously inferred by
/// counting invitations and administrator accounts, which made the invitation
/// table a second, quieter source of truth for whether a tenant was live — one
/// that could disagree with the tenant record itself.
/// </summary>
public static class TenantOperationalStatus
{
    public const string AwaitingActivation = "invited";
    public const string Active = "active";
    public const string Suspended = "suspended";
    public const string Archived = "archived";

    public static string For(Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);

        if (tenant.IsArchived) return Archived;
        if (!tenant.IsActive) return Suspended;

        return tenant.AdministratorActivationStatus == TenantAdministratorActivationStatus.Active
            ? Active
            : AwaitingActivation;
    }
}
