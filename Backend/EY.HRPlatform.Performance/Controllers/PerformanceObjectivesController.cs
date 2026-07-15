using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Features.Objectives.Dtos;
using EY.HRPlatform.Performance.Features.Objectives.Queries;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/objectives")]
[Authorize]
public sealed class PerformanceObjectivesController(ISender sender) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<PerformanceObjectiveDto>>.Success(
            await sender.Send(new GetMyObjectivesQuery(), cancellationToken)));

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreatePerformanceObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateObjectiveCommand(
            request.CycleId, request.Title, request.Description, request.SuccessMeasure,
            request.Target, request.DueDate, request.Weight, request.ParentObjectiveId), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : CreatedAtAction(nameof(GetMine), ApiResponse<Guid>.Success(result.Value));
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new SubmitObjectiveCommand(id), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    [HttpPost("{id:guid}/approval")]
    public async Task<IActionResult> DecideApproval(
        Guid id,
        [FromBody] DecideObjectiveApprovalRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ObjectiveApprovalDecision>(request.Decision, true, out var decision))
            return BadRequest(ApiResponse.Failure("Unknown objective approval decision."));

        var result = await sender.Send(new DecideObjectiveApprovalCommand(id, request.WorkItemId, decision), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase) ||
            error.Code.Contains("DueDate", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }
}

public sealed record CreatePerformanceObjectiveRequest(
    Guid CycleId,
    string Title,
    string? Description,
    string SuccessMeasure,
    string Target,
    DateTime DueDate,
    decimal? Weight,
    Guid? ParentObjectiveId = null);

public sealed record DecideObjectiveApprovalRequest(Guid WorkItemId, string Decision);
