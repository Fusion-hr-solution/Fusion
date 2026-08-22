using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.StrategicDirection;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}/strategy")]
public sealed class StrategyController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<StrategicObjectiveDto>>>> List(Guid cycleId, CancellationToken cancellationToken)
    {
        // Published strategy is direction anyone in the Cycle can read; drafts are visible to
        // the strategy owner and administrators. The read model itself is not employee-detail.
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new ListStrategyQuery(cycleId), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<StrategicObjectiveDto>>> Create(
        Guid cycleId,
        [FromBody] CreateStrategicObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanPublishStrategy(User)) return Forbid();
        return MapResult(await mediator.Send(new CreateStrategicObjectiveCommand(cycleId, request), cancellationToken));
    }

    [HttpPut("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<StrategicObjectiveDto>>> Update(
        Guid cycleId,
        Guid objectiveId,
        [FromBody] UpdateStrategicObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanPublishStrategy(User)) return Forbid();
        return MapResult(await mediator.Send(new UpdateStrategicObjectiveCommand(cycleId, objectiveId, request), cancellationToken));
    }

    [HttpPost("{objectiveId:guid}/publish")]
    public async Task<ActionResult<ApiResponse<StrategicObjectiveDto>>> Publish(
        Guid cycleId,
        Guid objectiveId,
        CancellationToken cancellationToken)
    {
        if (!policy.CanPublishStrategy(User)) return Forbid();
        return MapResult(await mediator.Send(new PublishStrategicObjectiveCommand(cycleId, objectiveId), cancellationToken));
    }

    [HttpDelete("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(
        Guid cycleId,
        Guid objectiveId,
        CancellationToken cancellationToken)
    {
        if (!policy.CanPublishStrategy(User)) return Forbid();
        return MapResult(await mediator.Send(new DeleteStrategicObjectiveCommand(cycleId, objectiveId), cancellationToken));
    }
}
