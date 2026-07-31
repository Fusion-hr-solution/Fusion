using EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Queries;
using EY.HRPlatform.Performance.Features.Progress.Commands;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/employee-objectives")]
[Authorize]
public sealed class EmployeeObjectivesController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("my-campaigns")]
    public async Task<IActionResult> GetMyCampaigns(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();

        var result = await sender.Send(new GetMyObjectivePlanCampaignsQuery(), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<MyObjectivePlanCampaignDto>>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetWorkspace(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();

        var result = await sender.Send(new GetMyObjectivePlanWorkspaceQuery(slug), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<EmployeeObjectivePlanWorkspaceDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/objectives")]
    public async Task<IActionResult> Create(
        Guid cycleId,
        [FromBody] SaveEmployeeObjectiveRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();

        var result = await sender.Send(new SaveObjectiveCommand(cycleId, null, null, request), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<EmployeeObjectivePlanDto>.Success(result.Value));
    }

    [HttpPut("campaigns/{cycleId:guid}/objectives/{objectiveId:guid}")]
    public async Task<IActionResult> Update(
        Guid cycleId,
        Guid objectiveId,
        [FromBody] SaveEmployeeObjectiveRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new SaveObjectiveCommand(cycleId, objectiveId, expectedVersion, request),
            cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<EmployeeObjectivePlanDto>.Success(result.Value));
    }

    [HttpDelete("campaigns/{cycleId:guid}/objectives/{objectiveId:guid}")]
    public async Task<IActionResult> Delete(
        Guid cycleId,
        Guid objectiveId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new DeleteObjectiveCommand(cycleId, objectiveId, expectedVersion), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    [HttpPost("campaigns/{cycleId:guid}/submit")]
    public async Task<IActionResult> Submit(
        Guid cycleId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new SubmitObjectivePlanCommand(cycleId, expectedVersion), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<SubmitObjectivePlanResponseDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/objectives/{objectiveId:guid}/progress")]
    public async Task<IActionResult> RecordProgress(
        Guid cycleId,
        Guid objectiveId,
        [FromBody] RecordObjectiveProgressRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageOwnObjectives(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new RecordObjectiveProgressCommand(cycleId, objectiveId, expectedVersion, request),
            cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<RecordObjectiveProgressResponseDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(error.Message));

        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Required", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Failure(error.Message));

        return Conflict(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

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
