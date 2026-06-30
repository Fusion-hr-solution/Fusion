using EY.HRPlatform.Performance.Features.PlatformDefaults.Commands;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Dtos;
using EY.HRPlatform.Performance.Features.PlatformDefaults.Queries;
using EY.HRPlatform.Performance.Features.Security;
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

    [HttpPost("guardrails/draft")]
    public async Task<IActionResult> CreateGuardrailsDraft(
        [FromBody] CreateGuardrailsDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(
            new CreateGuardrailsDraftCommand(User, request), cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        SetETag(result.Value.Version);
        return Ok(ApiResponse<GuardrailsDto>.Success(result.Value));
    }

    [HttpPut("guardrails/draft")]
    public async Task<IActionResult> UpdateGuardrailsDraft(
        [FromBody] CreateGuardrailsDraftRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new UpdateGuardrailsDraftCommand(User, request, expectedVersion), cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        SetETag(result.Value.Version);
        return Ok(ApiResponse<GuardrailsDto>.Success(result.Value));
    }

    [HttpPost("guardrails/publish")]
    public async Task<IActionResult> PublishGuardrails(
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(
            new PublishGuardrailsCommand(User, expectedVersion), cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<GuardrailsDto>.Success(result.Value))
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

    [HttpPost("baseline/draft")]
    public async Task<IActionResult> CreateBaselineDraft(
        [FromBody] CreateBaselineDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(
            new CreateBaselineDraftCommand(User, request), cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<BaselineVersionDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPut("baseline/draft")]
    public async Task<IActionResult> UpdateBaselineDraft(
        [FromBody] CreateBaselineDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(
            new UpdateBaselineDraftCommand(User, request), cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<BaselineVersionDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpPost("baseline/publish")]
    public async Task<IActionResult> PublishBaseline(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManagePlatformDefaults(User))
            return Forbid();

        var result = await sender.Send(new PublishBaselineCommand(User), cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<BaselineVersionDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.EndsWith("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.EndsWith("ConcurrencyConflict", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("ImpactConflict", StringComparison.OrdinalIgnoreCase) ||
            error.Code.EndsWith("DraftExists", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse.Failure(error.Message));

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
