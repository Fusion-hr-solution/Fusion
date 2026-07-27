using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamProgress.Dtos;
using EY.HRPlatform.Performance.Features.TeamProgress.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/team-progress")]
[Authorize]
public sealed class TeamProgressController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet("my-campaigns")]
    public async Task<IActionResult> GetMyCampaigns(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTeamProgress(User))
            return Denied();

        var result = await sender.Send(new GetMyTeamProgressCampaignsQuery(), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<TeamProgressCampaignDto>>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetWorkspace(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTeamProgress(User))
            return Denied();

        var result = await sender.Send(new GetTeamProgressWorkspaceQuery(slug), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<TeamProgressWorkspaceDto>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}/participants/{employeeId:guid}")]
    public async Task<IActionResult> GetParticipantDetail(
        string slug,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewTeamProgress(User))
            return Denied();

        var result = await sender.Send(new GetTeamProgressParticipantDetailQuery(slug, employeeId), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<TeamProgressParticipantDetailDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error) => Problem(error);
}
