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

/// <summary>
/// Tenant-scoped endpoints for objective policy lifecycle management.
/// Requires policy-manage permission (tenant-scoped). ETag/If-Match for optimistic concurrency.
/// </summary>
[ApiController]
[Route("api/performance/policy")]
[Authorize]
public class ObjectivePolicyController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetPolicy(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectivePolicy(User))
            return Forbid();

        var result = await sender.Send(new GetPolicyQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<PolicySummaryDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetPolicyHistory(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewObjectivePolicy(User))
            return Forbid();

        var result = await sender.Send(new GetPolicyHistoryQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<IReadOnlyList<PolicyVersionDto>>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyPolicy(
        [FromBody] ApplyPolicyRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePolicy(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new ApplyPolicyCommand(User, request, expectedVersion), cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        SetETag(result.Value.Version);
        return Ok(ApiResponse<PolicyVersionDto>.Success(result.Value));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.EndsWith("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.EndsWith("StaleApply", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("ConcurrencyConflict", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("CompatibilityConflict", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));

        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("Feasibility", StringComparison.OrdinalIgnoreCase))
            return UnprocessableEntity(ApiResponse.Failure(error.Message));

        return BadRequest(ApiResponse.Failure(error.Message));
    }

    private IActionResult PreconditionRequired()
        => StatusCode(StatusCodes.Status428PreconditionRequired,
            ApiResponse.Failure("If-Match header with the current version is required."));

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
