using EY.HRPlatform.Performance.Features.CheckIns.Commands;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Features.CheckIns.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/check-ins")]
[Authorize]
public sealed class CheckInsController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    // ─── Reviewer reads ─────────────────────────────────────────────────────

    [HttpGet("campaigns/{cycleId:guid}/participants/{employeeId:guid}")]
    public async Task<IActionResult> GetParticipantPanel(Guid cycleId, Guid employeeId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new GetCheckInParticipantPanelQuery(cycleId, employeeId), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInParticipantPanelDto>.Success(result.Value));
    }

    [HttpGet("{checkInId:guid}")]
    public async Task<IActionResult> GetDetail(Guid checkInId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User) && !accessPolicy.CanViewOwnCheckIns(User))
            return Forbid();
        var result = await sender.Send(new GetCheckInDetailQuery(checkInId), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInDetailDto>.Success(result.Value));
    }

    // ─── Employee reads ─────────────────────────────────────────────────────

    [HttpGet("mine")]
    public async Task<IActionResult> GetMine([FromQuery] Guid cycleId, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewOwnCheckIns(User))
            return Forbid();
        var result = await sender.Send(new GetEmployeeCheckInsQuery(cycleId), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<EmployeeCheckInsDto>.Success(result.Value));
    }

    // ─── Reviewer commands ──────────────────────────────────────────────────

    [HttpPost("campaigns/{cycleId:guid}")]
    public async Task<IActionResult> Plan(Guid cycleId, [FromBody] PlanCheckInRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new PlanCheckInCommand(cycleId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    [HttpPost("{checkInId:guid}/reschedule")]
    public async Task<IActionResult> Reschedule(Guid checkInId, [FromBody] RescheduleCheckInRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new RescheduleCheckInCommand(checkInId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    [HttpPost("{checkInId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid checkInId, [FromBody] CancelCheckInRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new CancelCheckInCommand(checkInId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    [HttpPost("{checkInId:guid}/complete")]
    public async Task<IActionResult> Complete(Guid checkInId, [FromBody] CompleteCheckInRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new CompleteCheckInCommand(checkInId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    [HttpPost("{checkInId:guid}/addendum")]
    public async Task<IActionResult> AddAddendum(Guid checkInId, [FromBody] AddCheckInAddendumRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new AddCheckInAddendumCommand(checkInId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    // ─── Follow-up action commands ──────────────────────────────────────────

    [HttpPost("actions/{actionId:guid}/complete")]
    public async Task<IActionResult> CompleteAction(Guid actionId, [FromBody] CompleteFollowUpActionRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewOwnCheckIns(User) && !accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new CompleteFollowUpActionCommand(actionId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<FollowUpActionMutationResult>.Success(result.Value));
    }

    [HttpPost("actions/{actionId:guid}/cancel")]
    public async Task<IActionResult> CancelAction(Guid actionId, [FromBody] CancelFollowUpActionRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new CancelFollowUpActionCommand(actionId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<FollowUpActionMutationResult>.Success(result.Value));
    }

    // ─── Employee commands ──────────────────────────────────────────────────

    [HttpPost("{checkInId:guid}/response")]
    public async Task<IActionResult> AddResponse(Guid checkInId, [FromBody] AddCheckInEmployeeResponseRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewOwnCheckIns(User))
            return Forbid();
        var result = await sender.Send(new AddCheckInEmployeeResponseCommand(checkInId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<CheckInMutationResult>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/discussion-signals")]
    public async Task<IActionResult> RaiseSignal(Guid cycleId, [FromBody] RaiseDiscussionSignalRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();
        var result = await sender.Send(new RaiseDiscussionSignalCommand(cycleId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<DiscussionSignalMutationResult>.Success(result.Value));
    }

    [HttpPost("discussion-signals/{signalId:guid}/close")]
    public async Task<IActionResult> CloseSignal(Guid signalId, [FromBody] CloseDiscussionSignalRequest request, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanConductCheckIns(User))
            return Forbid();
        var result = await sender.Send(new CloseDiscussionSignalCommand(signalId, request), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<DiscussionSignalMutationResult>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(error.Message));
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }
}
