namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Canonical bootstrap lifecycle of a customer tenant.
/// Provisioning creates the tenant awaiting activation; successful Initial Tenant
/// Administrator activation is the only supported transition to Active.
/// </summary>
public enum TenantAdministratorActivationStatus
{
    AwaitingAdministratorActivation = 0,
    Active = 1,
}
