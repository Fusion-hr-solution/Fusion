namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

/// <summary>Organizations list row for Platform Admin.</summary>
public sealed class PlatformOrganizationSummaryDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    /// <summary>draft | invited | active | suspended | archived</summary>
    public required string OperationalStatus { get; init; }
    public int ActiveUserCount { get; init; }
    public int PendingInviteCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? LastActivityAt { get; init; }
    public bool IsActive { get; init; }
    public bool IsArchived { get; init; }
}
