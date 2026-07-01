using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Dtos;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Queries;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/collective-objectives")]
[Authorize]
public sealed class CollectiveObjectivesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? cycleId,
        [FromQuery] Guid? strategicParentId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetCollectiveObjectivesQuery(cycleId, strategicParentId), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<CollectiveObjectiveDto>>.Success(result.Value));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateCollectiveObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateCollectiveObjectiveCommand(
            request.CycleId, request.OrgUnitId, request.StrategicParentId,
            request.Title, request.Description, request.Weight, request.DueDate), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : CreatedAtAction(nameof(GetAll), ApiResponse<Guid>.Success(result.Value));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> DecideApproval(
        Guid id,
        [FromBody] DecideCollectiveObjectiveApprovalRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ObjectiveApprovalDecision>(request.Decision, true, out var decision))
            return BadRequest(ApiResponse.Failure("Unknown collective objective approval decision."));

        var result = await sender.Send(
            new DecideCollectiveObjectiveApprovalCommand(id, request.WorkItemId, decision), cancellationToken);

        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }
}
