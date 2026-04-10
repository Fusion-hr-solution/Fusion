namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationListQueryDto
{
    public int Skip { get; init; } = 0;
    public int Take { get; init; } = 20;

    public string? Search { get; init; }

    /// <summary>draft | invited | active | suspended | archived</summary>
    public string[]? FilterByStatus { get; init; }

    /// <summary>When true, only return orgs that need attention.</summary>
    public bool? FilterNeedsAttention { get; init; }

    /// <summary>name | createdAt | operationalStatus | activeUserCount | pendingInviteCount | lastActivityAt</summary>
    public string OrderBy { get; init; } = "createdAt";
    public string OrderDirection { get; init; } = "desc";
}

