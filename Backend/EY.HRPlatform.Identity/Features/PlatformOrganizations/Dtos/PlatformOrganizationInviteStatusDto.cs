namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationInviteStatusDto
{
    public Guid? InviteId { get; init; }
    /// <summary>pending | accepted | expired | none</summary>
    public required string Status { get; init; }
    public string? Email { get; init; }
    public DateTime? SentAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    /// <summary>Absolute URL for the first admin to accept (contains opaque token).</summary>
    public string? InviteLink { get; init; }
}
