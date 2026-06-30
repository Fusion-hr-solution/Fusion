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

    [HttpPost("draft")]
    public async Task<IActionResult> CreateDraft(
        [FromBody] CreatePolicyDraftRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePolicy(User))
            return Forbid();

        var result = await sender.Send(new CreatePolicyDraftCommand(User, request), cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        SetETag(result.Value.Version);
        return Ok(ApiResponse<PolicyVersionDto>.Success(result.Value));
    }

    [HttpPut("draft")]
    public async Task<IActionResult> UpdateDraft(
        [FromBody] UpdatePolicyDraftRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePolicy(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var req = request with { ExpectedVersion = expectedVersion };
        var result = await sender.Send(new UpdatePolicyDraftCommand(User, req), cancellationToken);

        if (result.IsFailure)
            return MapFailure(result.Error);

        SetETag(result.Value.Version);
        return Ok(ApiResponse<PolicyVersionDto>.Success(result.Value));
    }

    [HttpPost("draft/publish")]
    public async Task<IActionResult> PublishDraft(
        [FromBody] PublishPolicyRequest? request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePolicy(User))
            return Forbid();

        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var req = new PublishPolicyRequest(expectedVersion, request?.ChangeSummary);
        var result = await sender.Send(new PublishPolicyCommand(User, req), cancellationToken);

        return result.IsSuccess
            ? Ok(ApiResponse<PolicyVersionDto>.Success(result.Value))
            : MapFailure(result.Error);
    }

    [HttpDelete("draft")]
    public async Task<IActionResult> DiscardDraft(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanManageObjectivePolicy(User))
            return Forbid();

        var result = await sender.Send(new DiscardPolicyDraftCommand(User), cancellationToken);

        return result.IsSuccess
            ? NoContent()
            : MapFailure(result.Error);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void SetETag(uint version) => Response.Headers.ETag = $"\"{version}\"";

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.EndsWith("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.EndsWith("ConcurrencyConflict", StringComparison.OrdinalIgnoreCase) ||
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
