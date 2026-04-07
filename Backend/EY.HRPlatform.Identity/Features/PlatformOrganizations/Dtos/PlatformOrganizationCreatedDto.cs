namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

/// <summary>Response after provisioning a customer org + first admin invite.</summary>
public sealed class PlatformOrganizationCreatedDto
{
    public required PlatformOrganizationDetailDto Organization { get; init; }
    public required string InviteLink { get; init; }
}
