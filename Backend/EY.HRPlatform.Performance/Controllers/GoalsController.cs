using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Organizational goals under a Cycle: the alignment/list read models and the create → align →
/// publish → contribution flows. An authorized scope owner establishes and publishes an
/// organizational objective as official direction; there is no routine parent-approval step. The
/// controller resolves the caller's contextual authorization inputs from the token and Forbid()s the
/// obvious case first; the handlers enforce the fine-grained contextual rule (objective-accountable
/// maintenance) that a claim alone cannot express.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}/goals")]
public sealed class GoalsController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private GoalActorContext Actor => new(
        User.GetEmployeeId() ?? Guid.Empty,
        policy.CanAdministerCycles(User),
        policy.CanManageOrganizationalObjectives(User));

    [HttpGet]
    public async Task<ActionResult<ApiResponse<GoalsOverviewDto>>> Overview(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetGoalsOverviewQuery(cycleId, Actor), cancellationToken));
    }

    [HttpGet("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> Detail(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetGoalDetailQuery(cycleId, objectiveId, Actor), cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> Create(
        Guid cycleId, [FromBody] CreateOrganizationalObjectiveRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new CreateOrganizationalObjectiveCommand(cycleId, request, Actor), cancellationToken));
    }

    [HttpPut("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> Update(
        Guid cycleId, Guid objectiveId, [FromBody] UpdateOrganizationalObjectiveRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new UpdateOrganizationalObjectiveCommand(cycleId, objectiveId, request, Actor), cancellationToken));
    }

    [HttpPost("{objectiveId:guid}/align")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> Align(
        Guid cycleId, Guid objectiveId, [FromBody] AlignObjectiveRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new AlignObjectiveCommand(cycleId, objectiveId, request, Actor), cancellationToken));
    }

    [HttpPost("{objectiveId:guid}/publish")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> Publish(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new PublishObjectiveCommand(cycleId, objectiveId, Actor), cancellationToken));
    }

    [HttpPut("{objectiveId:guid}/contribution")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> ConfigureContribution(
        Guid cycleId, Guid objectiveId, [FromBody] ConfigureContributionRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new ConfigureContributionCommand(cycleId, objectiveId, request, Actor), cancellationToken));
    }

    [HttpPost("{objectiveId:guid}/contribution/lock")]
    public async Task<ActionResult<ApiResponse<GoalDetailDto>>> LockContribution(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new LockContributionCommand(cycleId, objectiveId, Actor), cancellationToken));
    }

    [HttpDelete("{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new DeleteObjectiveCommand(cycleId, objectiveId, Actor), cancellationToken));
    }
}
