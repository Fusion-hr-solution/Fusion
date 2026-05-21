namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationStatsDto
{
    public required int TotalOrganizations { get; init; }
    public required int InvitedPending { get; init; }
    public required int ActiveOrganizations { get; init; }
    public required int DraftOrganizations { get; init; }
    public required int SuspendedOrganizations { get; init; }
    public required int ArchivedOrganizations { get; init; }
}
