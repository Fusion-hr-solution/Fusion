namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Customer modules that this feature can entitle for a tenant.
/// Core HR is mandatory for every provisioned tenant and cannot be disabled.
/// Training, Onboarding, Interview, Learning, and Recruitment are owned by other
/// modules and are deliberately not provisionable here.
/// </summary>
public enum TenantModule
{
    CoreHR = 0,
    Performance = 1,
}
