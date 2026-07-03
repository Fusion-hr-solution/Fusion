using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Platform-only endpoints for guardrails and baseline management.
/// All endpoints require PlatformRole.PlatformAdmin — tenant users cannot reach platform data.
/// </summary>
[ApiController]
[Route("api/performance/platform/defaults")]
[Authorize]
public class ObjectiveDefaultsController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    // ─── Guardrails ───────────────────────────────────────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new GetPlatformDefaultsSummaryQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<PlatformDefaultsSummaryDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpGet("guardrails")]
    public async Task<IActionResult> GetGuardrails(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new GetGuardrailsQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<GuardrailsDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    /// <summary>
    /// Atomically applies advanced platform limits in one step (no Draft lifecycle). Returns the
    /// applied limits, or a blocked result carrying the impact when active tenants/standard setup conflict.
    /// </summary>
    [HttpPost("guardrails/apply")]
    public async Task<IActionResult> ApplyGuardrails(
        [FromBody] ApplyGuardrailsRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new ApplyGuardrailsCommand(User, request), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<GuardrailsApplyResultDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    // ─── Baseline ─────────────────────────────────────────────────────────────

    [HttpGet("baseline")]
    public async Task<IActionResult> GetBaseline(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new GetBaselineQuery(), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<IReadOnlyList<BaselineVersionDto>>.Success(result.Value))
            : MapFailure(result.Error);
    }

    /// <summary>
    /// Atomically applies the standard-setup baseline in one step (no Draft lifecycle). Publishes a
    /// new version (superseding the prior, preserving history) when valid, or returns validation errors.
    /// </summary>
    [HttpPost("baseline/apply")]
    public async Task<IActionResult> ApplyBaseline(
        [FromBody] ApplyBaselineRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new ApplyBaselineCommand(User, request), cancellationToken);
        return result.IsSuccess
            ? Ok(ApiResponse<BaselineApplyResultDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.EndsWith("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.EndsWith("ConcurrencyConflict", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("ImpactConflict", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));

        return BadRequest(ApiResponse.Failure(error.Message));
    }
}
