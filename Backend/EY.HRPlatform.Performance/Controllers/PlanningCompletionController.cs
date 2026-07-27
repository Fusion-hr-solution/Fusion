using EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/planning-completion")]
[Authorize]
public sealed class PlanningCompletionController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : PerformanceControllerBase
{
    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetWorkspace(
        string slug,
        [FromQuery] string? status,
        [FromQuery] string? blocker,
        [FromQuery] bool? overdue,
        [FromQuery] bool? reminderNeeded,
        [FromQuery] Guid? approverEmployeeId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        if (!accessPolicy.CanViewCycles(User))
            return Denied();

        var result = await sender.Send(new GetPlanningCompletionWorkspaceQuery(
            slug,
            status,
            blocker,
            overdue,
            reminderNeeded,
            approverEmployeeId,
            search,
            page,
            pageSize), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionWorkspaceDto>.Success(result.Value));
    }

    [HttpGet("campaigns/{cycleId:guid}/participants/{participantEmployeeId:guid}")]
    public async Task<IActionResult> GetParticipantDetail(
        Guid cycleId,
        Guid participantEmployeeId,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewCycles(User))
            return Denied();

        var result = await sender.Send(
            new GetPlanningCompletionParticipantDetailQuery(cycleId, participantEmployeeId),
            cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionParticipantDetailDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/reminders")]
    public async Task<IActionResult> RecordReminder(
        Guid cycleId,
        [FromBody] RecordPlanningReminderRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Denied();

        var result = await sender.Send(new RecordPlanningReminderCommand(cycleId, request), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionParticipantDetailDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/participants/{participantEmployeeId:guid}/reassign-reviewer")]
    public async Task<IActionResult> ReassignReviewer(
        Guid cycleId,
        Guid participantEmployeeId,
        [FromBody] ReassignPlanningReviewerRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Denied();

        var result = await sender.Send(
            new ReassignPlanningReviewerCommand(cycleId, participantEmployeeId, request),
            cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionParticipantDetailDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/participants/{participantEmployeeId:guid}/exclude")]
    public async Task<IActionResult> ExcludeParticipant(
        Guid cycleId,
        Guid participantEmployeeId,
        [FromBody] ExcludePlanningParticipantRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageCycles(User))
            return Denied();

        var result = await sender.Send(
            new ExcludePlanningParticipantCommand(cycleId, participantEmployeeId, request),
            cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionParticipantDetailDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/lock")]
    public async Task<IActionResult> LockPlanning(
        Guid cycleId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] LockPlanningRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanOperateCycles(User))
            return Denied();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new LockPlanningCommand(cycleId, expectedVersion, request), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanningCompletionWorkspaceDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error) => Problem(error);

    private IActionResult PreconditionRequired()
        => MissingPrecondition();

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
            return false;

        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[2..].Trim('"');

        return uint.TryParse(trimmed, out version);
    }
}
