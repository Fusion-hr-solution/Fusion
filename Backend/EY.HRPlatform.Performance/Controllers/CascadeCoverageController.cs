using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Features.TeamObjectives.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The shared read-only cascade coverage surface of a launched campaign. One endpoint, two
/// doors: HR reaches it with campaign permissions, Direction with the strategic-view permission —
/// no HR campaign or admin permission required.
/// </summary>
[ApiController]
[Route("api/performance/cascade-coverage")]
[Authorize]
public sealed class CascadeCoverageController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet("campaigns")]
    public async Task<IActionResult> GetCampaigns(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCascadeCoverage(User))
            return Denied();

        var result = await sender.Send(new GetCascadeCoverageCampaignsQuery(), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<CascadeCoverageCampaignDto>>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetCoverage(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCascadeCoverage(User))
            return Denied();

        var result = await sender.Send(new GetCascadeCoverageQuery(slug), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<CascadeCoverageDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error) => Problem(error);
}
