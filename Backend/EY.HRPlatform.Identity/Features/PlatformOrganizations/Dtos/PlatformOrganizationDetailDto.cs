namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationDetailDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required string OperationalStatus { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
    public string? InternalNotes { get; init; }
    public int ActiveUserCount { get; init; }
    public int PendingInviteCount { get; init; }
    public DateTime? LastActivityAt { get; init; }
    public bool IsActive { get; init; }
    public bool IsArchived { get; init; }
    public string? PrimaryAdminEmail { get; init; }
    public PlatformOrganizationInviteStatusDto FirstAdminInvite { get; init; } = null!;
}
