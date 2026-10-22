using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Insights;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/cycles")]
public sealed class CyclesController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet("{cycleId:guid}")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto>>> Get(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetCycleDetailQuery(cycleId, VisibilityActor()), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CycleSummaryDto>>> Create(
        [FromBody] CreateCycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new CreateCycleCommand(request), cancellationToken));
    }

    [HttpPut("{cycleId:guid}")]
    public async Task<ActionResult<ApiResponse<CycleSummaryDto>>> Update(
        Guid cycleId,
        [FromBody] UpdateCycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UpdateCycleCommand(cycleId, request), cancellationToken));
    }

    [HttpPost("{cycleId:guid}/activate")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto>>> Activate(Guid cycleId, [FromBody] ExpectedVersionRequest version, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new ActivateCycleCommand(cycleId, version.ExpectedVersion), cancellationToken));
    }

    /// <summary>Cycle › Insights: organization-wide counts by unit and manager, for cycle administrators only.</summary>
    [HttpGet("{cycleId:guid}/insights")]
    public async Task<ActionResult<ApiResponse<InsightsDto>>> Insights(Guid cycleId, [FromQuery] Guid? unitId, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetInsightsQuery(cycleId, unitId), cancellationToken));
    }

    /// <summary>The people behind one Insights figure, paged.</summary>
    [HttpGet("{cycleId:guid}/insights/people")]
    public async Task<ActionResult<ApiResponse<InsightsPeoplePageDto>>> InsightsPeople(
        Guid cycleId, [FromQuery] string metric, [FromQuery] Guid? unitId, [FromQuery] Guid? managerId, [FromQuery] int? level,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken cancellationToken = default)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetInsightsPeopleQuery(cycleId, metric, unitId, managerId, level, page, pageSize), cancellationToken));
    }

    [HttpGet("{cycleId:guid}/closure")]
    public async Task<ActionResult<ApiResponse<CycleClosureDto>>> GetClosure(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetCycleClosureQuery(cycleId), cancellationToken));
    }

    [HttpPost("{cycleId:guid}/close")]
    public async Task<ActionResult<ApiResponse<CycleDetailDto>>> Close(Guid cycleId, [FromBody] CloseCycleRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new CloseCycleCommand(cycleId, request), cancellationToken));
    }

    [HttpDelete("{cycleId:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid cycleId, [FromBody] ExpectedVersionRequest version, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new DeleteDraftCycleCommand(cycleId, version.ExpectedVersion), cancellationToken));
    }
    private CycleVisibilityActor VisibilityActor()
        => new(User.GetEmployeeId() ?? Guid.Empty, policy.CanAdministerCycles(User), policy.AggregateViewScope(User));
}
