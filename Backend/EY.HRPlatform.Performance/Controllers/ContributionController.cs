using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The Contribution Explorer under a Cycle: company strategic direction drilling into organizational
/// scope, with reported progress primary and coverage as quieter context. It surfaces organizational
/// aggregates only — never named employee objectives, evidence, or individual history — so it is
/// permission-safe by construction. Available to leadership and administration (aggregate view scope).
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}/contribution")]
public sealed class ContributionController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private bool CanExplore =>
        policy.CanAdministerCycles(User)
        || policy.CanPublishStrategy(User)
        || policy.CanReviewDirectReports(User);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<ContributionOverviewDto>>> Overview(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!CanExplore) return Forbid();
        return MapResult(await mediator.Send(new GetContributionOverviewQuery(cycleId), cancellationToken));
    }

    [HttpGet("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<ContributionDetailDto>>> Detail(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!CanExplore) return Forbid();
        return MapResult(await mediator.Send(new GetContributionDetailQuery(cycleId, objectiveId), cancellationToken));
    }
}
