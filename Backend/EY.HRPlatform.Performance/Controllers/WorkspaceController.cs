using EY.HRPlatform.Performance.Features.Overview;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Workspace;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>The Performance workspace composition for the selected Cycle — navigation, not authorization.</summary>
[ApiController]
[Authorize]
[Route("api/performance/context")]
public sealed class WorkspaceController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<WorkspaceContextDto>>> Get([FromQuery] Guid? cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        var grants = new WorkspaceGrants(
            policy.CanAdministerCycles(User),
            policy.CanPublishStrategy(User),
            policy.CanManageOrganizationalObjectives(User),
            policy.CanManageOwnParticipation(User),
            policy.CanCalibrateReviews(User),
            policy.AggregateViewScope(User),
            policy.CanViewSettings(User));
        return MapResult(await mediator.Send(new GetWorkspaceContextQuery(cycleId, grants), cancellationToken));
    }

    /// <summary>Overview: the sections that apply to the caller in the selected Cycle, as one projection.</summary>
    [HttpGet("~/api/performance/overview")]
    public async Task<ActionResult<ApiResponse<OverviewDto>>> Overview([FromQuery] Guid? cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        var actor = new PlanActorContext(
            User.GetEmployeeId() ?? Guid.Empty,
            policy.CanAdministerCycles(User),
            policy.CanReviewDirectReports(User));
        return MapResult(await mediator.Send(new GetOverviewQuery(cycleId, Grants(), actor), cancellationToken));
    }

    private WorkspaceGrants Grants() => new(
        policy.CanAdministerCycles(User),
        policy.CanPublishStrategy(User),
        policy.CanManageOrganizationalObjectives(User),
        policy.CanManageOwnParticipation(User),
        policy.CanCalibrateReviews(User),
        policy.AggregateViewScope(User),
        policy.CanViewSettings(User));
}
