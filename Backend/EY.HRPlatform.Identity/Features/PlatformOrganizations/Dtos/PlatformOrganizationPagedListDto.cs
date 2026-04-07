namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class PlatformOrganizationPagedListDto
{
    public required IReadOnlyList<PlatformOrganizationSummaryDto> Items { get; init; }
    public required int TotalCount { get; init; }
    public required PlatformOrganizationStatsDto Stats { get; init; }
}

