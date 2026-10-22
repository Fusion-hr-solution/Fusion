using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Work;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The caller's Performance work items and upcoming moments (the Fusion attention contracts), derived from current state.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/work")]
public sealed class WorkController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FusionWorkItemDto>>>> Get(CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetWorkItemsQuery(Actor()), cancellationToken));
    }

    [HttpGet("~/api/performance/upcoming")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FusionUpcomingDto>>>> GetUpcoming(
        [FromQuery] int days = 14, CancellationToken cancellationToken = default)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetUpcomingQuery(Actor(), days), cancellationToken));
    }

    private WorkActor Actor() => new(
        User.GetEmployeeId() ?? Guid.Empty,
        User.GetUserId(),
        policy.CanManageOwnParticipation(User),
        policy.CanReviewDirectReports(User),
        policy.CanAdministerCycles(User),
        policy.CanCalibrateReviews(User));
}
