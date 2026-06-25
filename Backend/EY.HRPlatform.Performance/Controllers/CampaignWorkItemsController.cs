using EY.HRPlatform.Performance.Features.WorkItems.Dtos;
using EY.HRPlatform.Performance.Features.WorkItems.Queries;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/work-items")]
[Authorize]
public sealed class CampaignWorkItemsController(ISender sender) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetMyWorkItemsQuery(), cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CampaignWorkItemDto>>.Success(result));
    }
}
