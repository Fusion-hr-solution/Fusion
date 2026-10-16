using EY.HRPlatform.Performance.Features.Development;
using EY.HRPlatform.Performance.Features.People;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// A participant's development plan in one cycle (D-34): the employee and their reviewer keep its goals
/// together, without approval; the handlers decide who may read and edit.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}/people/{employeeId:guid}/development")]
public sealed class DevelopmentController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    private PersonSummaryViewer Viewer => new(
        User.GetEmployeeId() ?? Guid.Empty,
        policy.CanReviewDirectReports(User),
        policy.CanAdministerCycles(User))
    {
        ManagesOwnParticipation = policy.CanManageOwnParticipation(User),
    };

    [HttpGet]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> Get(Guid cycleId, Guid employeeId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetDevelopmentPlanQuery(cycleId, employeeId, Viewer), cancellationToken));
    }

    [HttpPost("goals")]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> AddGoal(Guid cycleId, Guid employeeId,
        [FromBody] DevelopmentGoalInput input, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new AddDevelopmentGoalCommand(cycleId, employeeId, input, Viewer), cancellationToken));
    }

    [HttpPut("goals/{goalId:guid}")]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> UpdateGoal(Guid cycleId, Guid employeeId, Guid goalId,
        [FromBody] DevelopmentGoalInput input, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UpdateDevelopmentGoalCommand(cycleId, employeeId, goalId, input, Viewer), cancellationToken));
    }

    [HttpDelete("goals/{goalId:guid}")]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> RemoveGoal(Guid cycleId, Guid employeeId, Guid goalId,
        [FromBody] ExpectedVersionRequest version, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new RemoveDevelopmentGoalCommand(cycleId, employeeId, goalId, version.ExpectedVersion, Viewer), cancellationToken));
    }

    [HttpPost("carry-over")]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> CarryOver(Guid cycleId, Guid employeeId,
        [FromBody] CarryOverDevelopmentRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new CarryOverDevelopmentGoalsCommand(cycleId, employeeId, request, Viewer), cancellationToken));
    }

    [HttpPost("carry-over/dismiss")]
    public async Task<ActionResult<ApiResponse<DevelopmentPlanDto>>> DismissCarryOver(Guid cycleId, Guid employeeId,
        [FromBody] ExpectedVersionRequest version, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new DismissDevelopmentCarryOverCommand(cycleId, employeeId, version.ExpectedVersion, Viewer), cancellationToken));
    }
}
