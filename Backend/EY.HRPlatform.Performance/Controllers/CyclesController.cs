using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/cycles")]
public sealed class CyclesController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CycleSummaryDto>>>> List(CancellationToken cancellationToken)
    {
        // Any Performance entrant can see the Cycle list (state/breadth are enforced per-surface);
        // authoring/activation actions below require administration.
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new ListCyclesQuery(), cancellationToken));
    }

    [HttpGet("current")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto?>>> GetCurrent(CancellationToken cancellationToken)
    {
        // The workspace landing read: the primary Cycle's composed detail (or null),
        // resolved server-side so the overview needs no list→detail chain.
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetCurrentCycleDetailQuery(), cancellationToken));
    }

    [HttpGet("{cycleId:guid}")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto>>> Get(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetCycleDetailQuery(cycleId), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CycleSummaryDto>>> Create(
        [FromBody] CreateCycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new CreateCycleCommand(request), cancellationToken));
    }

    [HttpPut("{cycleId:guid}")]
    public async Task<ActionResult<ApiResponse<CycleSummaryDto>>> Update(
        Guid cycleId,
        [FromBody] UpdateCycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new UpdateCycleCommand(cycleId, request), cancellationToken));
    }

    [HttpPost("{cycleId:guid}/activate")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto>>> Activate(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new ActivateCycleCommand(cycleId), cancellationToken));
    }
}
