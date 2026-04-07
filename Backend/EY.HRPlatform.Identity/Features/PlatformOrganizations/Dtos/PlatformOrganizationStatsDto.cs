namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationStatsDto
{
    public required int TotalOrganizations { get; init; }
    public required int AttentionNeeded { get; init; }
    public required int InvitedPending { get; init; }
    public required int ActiveUserCount { get; init; }
}
