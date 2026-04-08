namespace EY.HRPlatform.Identity.Features.PlatformOrganizations;

/// <summary>
/// Derived lifecycle for Platform Admin operations console (organizations list / detail).
/// </summary>
public static class OrganizationOperationalStatus
{
    public const string Draft = "draft";
    public const string Invited = "invited";
    public const string Active = "active";
    public const string Attention = "attention";
    public const string Suspended = "suspended";
    public const string Archived = "archived";
}
