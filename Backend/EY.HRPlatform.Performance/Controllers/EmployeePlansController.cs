using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Employee plans under a Cycle: the employee authors and submits their own weighted plan, and the
/// responsible manager reviews it in a decision workspace and approves or returns it. The controller
/// resolves the caller's contextual authorization inputs from the token and Forbid()s the obvious
/// case first; the handlers enforce self-identity for authoring and the responsible-manager
/// relationship for review, which a claim alone cannot express.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}")]
public sealed class EmployeePlansController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private PlanActorContext Actor => new(
        User.GetEmployeeId() ?? Guid.Empty,
        policy.CanAdministerCycles(User),
        policy.CanReviewDirectReports(User));

    // ── My plan ──────────────────────────────────────────────────────────────

    [HttpGet("plan")]
    public async Task<ActionResult<ApiResponse<MyPlanStateDto>>> MyPlan(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetMyPlanQuery(cycleId, Actor), cancellationToken));
    }

    [HttpPost("plan")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> CreateMyPlan(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new CreateMyPlanCommand(cycleId, Actor), cancellationToken));
    }

    [HttpGet("plan/alignment-targets")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AlignmentTargetDto>>>> AlignmentTargets(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetAlignmentTargetsQuery(cycleId, Actor), cancellationToken));
    }

    [HttpPost("plan/objectives")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> AddObjective(
        Guid cycleId, [FromBody] AddPlanObjectiveRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new AddPlanObjectiveCommand(cycleId, request, Actor), cancellationToken));
    }

    [HttpPut("plan/objectives/{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> UpdateObjective(
        Guid cycleId, Guid objectiveId, [FromBody] UpdatePlanObjectiveRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new UpdatePlanObjectiveCommand(cycleId, objectiveId, request, Actor), cancellationToken));
    }

    [HttpDelete("plan/objectives/{objectiveId:guid}")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> RemoveObjective(
        Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new RemovePlanObjectiveCommand(cycleId, objectiveId, Actor), cancellationToken));
    }

    [HttpPut("plan/weights")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> SetWeights(
        Guid cycleId, [FromBody] SetPlanWeightsRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new SetPlanWeightsCommand(cycleId, request, Actor), cancellationToken));
    }

    [HttpPost("plan/submit")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> Submit(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanManageOwnParticipation(User)) return Forbid();
        return MapResult(await mediator.Send(new SubmitMyPlanCommand(cycleId, Actor), cancellationToken));
    }

    // ── Manager / administrator review ─────────────────────────────────────────

    [HttpGet("plans/reviews")]
    public async Task<ActionResult<ApiResponse<PlanReviewListDto>>> Reviews(Guid cycleId, CancellationToken cancellationToken)
    {
        if (!policy.CanReviewDirectReports(User) && !policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new GetPlanReviewsQuery(cycleId, Actor), cancellationToken));
    }

    [HttpGet("plans/{planId:guid}")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> PlanDetail(Guid cycleId, Guid planId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return Forbid();
        return MapResult(await mediator.Send(new GetPlanForReviewQuery(cycleId, planId, Actor), cancellationToken));
    }

    [HttpPost("plans/{planId:guid}/return")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> ReturnPlan(
        Guid cycleId, Guid planId, [FromBody] ReturnPlanRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanReviewDirectReports(User)) return Forbid();
        return MapResult(await mediator.Send(new ReturnPlanCommand(cycleId, planId, request, Actor), cancellationToken));
    }

    [HttpPost("plans/{planId:guid}/approve")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> ApprovePlan(Guid cycleId, Guid planId, CancellationToken cancellationToken)
    {
        if (!policy.CanReviewDirectReports(User)) return Forbid();
        return MapResult(await mediator.Send(new ApprovePlanCommand(cycleId, planId, Actor), cancellationToken));
    }

    [HttpPost("plans/{planId:guid}/exceptional-approve")]
    public async Task<ActionResult<ApiResponse<EmployeePlanDto>>> ExceptionalApprove(
        Guid cycleId, Guid planId, [FromBody] ExceptionalApprovePlanRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new ExceptionalApprovePlanCommand(cycleId, planId, request, Actor), cancellationToken));
    }
}
