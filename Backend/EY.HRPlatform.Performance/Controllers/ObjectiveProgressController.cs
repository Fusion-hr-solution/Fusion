using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Features.Milestones.Dtos;
using EY.HRPlatform.Performance.Features.Milestones.Queries;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/objectives/{objectiveId:guid}/progress")]
public sealed class ObjectiveProgressController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Retrieves the current effective progress for an objective.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProgress(Guid objectiveId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetObjectiveProgressQuery(objectiveId), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<ObjectiveProgressDto>.Success(result.Value!))
            : NotFound(ApiResponse.Failure(result.Error!.Message));
    }

    /// <summary>
    /// Updates the manual progress percent on a ManualPercent-mode objective (owner only).
    /// </summary>
    [HttpPut("manual")]
    public async Task<IActionResult> UpdateProgress(
        Guid objectiveId,
        [FromBody] UpdateObjectiveProgressRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new UpdateObjectiveProgressCommand(objectiveId, request.Percent, request.Comment), cancellationToken);
        return result.IsSuccess
            ? NoContent()
            : MapFailure(result.Error!);
    }

    /// <summary>
    /// Manager correction: overrides mode and percent, requires a reason. Emits governance audit event.
    /// </summary>
    [HttpPost("correct")]
    public async Task<IActionResult> CorrectProgress(
        Guid objectiveId,
        [FromBody] CorrectObjectiveProgressRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CorrectObjectiveProgressCommand(objectiveId, request.Percent, request.Reason), cancellationToken);
        return result.IsSuccess
            ? NoContent()
            : MapFailure(result.Error!);
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
