using EY.HRPlatform.Performance.Features.ObjectivePolicy.Commands;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/objective-planning/configuration")]
[Authorize]
public class ObjectivePlanningConfigurationController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectivePlanningConfiguration(User))
            return Forbid();

        var result = await sender.Send(new GetObjectivePlanningConfigurationQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<ObjectivePlanningConfigurationSummaryDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPost("apply")]
    public async Task<IActionResult> Apply(
        [FromBody] ApplyObjectivePlanningConfigurationRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePlanningConfiguration(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return StatusCode(StatusCodes.Status428PreconditionRequired,
                ApiResponse.Failure("If-Match header with the current version is required."));

        var result = await sender.Send(
            new ApplyObjectivePlanningConfigurationCommand(User, request, expectedVersion),
            cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        if (result.Value is { Applied: true, Configuration: { } configuration })
            Response.Headers.ETag = $"\"{configuration.Version}\"";

        return Ok(ApiResponse<ObjectivePlanningConfigurationApplyResultDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.EndsWith("NotConfigured", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.EndsWith("StaleApply", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("ConcurrencyConflict", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message));
        return BadRequest(ApiResponse.Failure(error.Message));
    }

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch)) return false;
        var trimmed = ifMatch.Trim().Trim('"');
        if (trimmed.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
            trimmed = trimmed[2..].Trim('"');
        return uint.TryParse(trimmed, out version);
    }
}
