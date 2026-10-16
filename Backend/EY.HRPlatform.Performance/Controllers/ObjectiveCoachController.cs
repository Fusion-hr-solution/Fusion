using EY.HRPlatform.Performance.Features.Ai;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The AI objective coach. It saves nothing: it returns suggestions for the draft a composer holds.
/// The plan surface needs the caller's own-participation grant, as plan authoring does; the team
/// surface is authorized by the handler with the team objective policy. Each person gets
/// <see cref="ObjectiveCoachVersions.CallsPerMinute"/> calls a minute; the client hides the coach on a 429.
/// </summary>
[ApiController]
[Authorize]
[EnableRateLimiting(ObjectiveCoachVersions.RateLimitPolicy)]
[Route("api/performance/cycles/{cycleId:guid}/objective-coach")]
public sealed class ObjectiveCoachController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ObjectiveCoachResultDto>>> Coach(
        Guid cycleId, [FromBody] ObjectiveCoachRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        if (request.Surface == ObjectiveCoachSurface.Plan && !policy.CanManageOwnParticipation(User)) return CapabilityForbidden();
        var actor = new GoalActorContext(
            User.GetEmployeeId() ?? Guid.Empty,
            policy.CanAdministerCycles(User),
            policy.CanManageOrganizationalObjectives(User),
            policy.CanReviewDirectReports(User),
            policy.CanPublishStrategy(User));
        return MapResult(await mediator.Send(new RunObjectiveCoachCommand(cycleId, request, actor), cancellationToken));
    }
}
