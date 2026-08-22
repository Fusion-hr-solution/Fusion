using EY.HRPlatform.Performance.Features.Population;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}/population")]
public sealed class PopulationController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PopulationDto>>> Get(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new GetPopulationQuery(cycleId), cancellationToken));
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<PopulationDto>>> Set(
        Guid cycleId,
        [FromBody] SetPopulationRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new SetPopulationCommand(cycleId, request), cancellationToken));
    }

    [HttpPost("confirm")]
    public async Task<ActionResult<ApiResponse<PopulationDto>>> Confirm(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new ConfirmPopulationCommand(cycleId), cancellationToken));
    }
}
