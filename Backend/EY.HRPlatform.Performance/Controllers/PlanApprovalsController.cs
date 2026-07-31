using EY.HRPlatform.Performance.Features.PlanApprovals.Commands;
using EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;
using EY.HRPlatform.Performance.Features.PlanApprovals.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/plan-approvals")]
[Authorize]
public sealed class PlanApprovalsController(
    ISender sender,
    IPerformanceAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("my-campaigns")]
    public async Task<IActionResult> GetMyCampaigns(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanApproveEmployeePlans(User))
            return Forbid();

        var result = await sender.Send(new GetMyPlanApprovalCampaignsQuery(), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<IReadOnlyList<PlanApprovalCampaignDto>>.Success(result.Value));
    }

    [HttpGet("campaigns/{slug}")]
    public async Task<IActionResult> GetWorkspace(string slug, CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanApproveEmployeePlans(User))
            return Forbid();

        var result = await sender.Send(new GetPlanApprovalWorkspaceQuery(slug), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanApprovalWorkspaceDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/plans/{planId:guid}/approve")]
    public async Task<IActionResult> Approve(
        Guid cycleId,
        Guid planId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanApproveEmployeePlans(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new ApproveObjectivePlanCommand(cycleId, planId, expectedVersion), cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanApprovalReviewDto>.Success(result.Value));
    }

    [HttpPost("campaigns/{cycleId:guid}/plans/{planId:guid}/request-changes")]
    public async Task<IActionResult> RequestChanges(
        Guid cycleId,
        Guid planId,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        [FromBody] RequestObjectivePlanChangesRequest request,
        CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanApproveEmployeePlans(User))
            return Forbid();
        if (!TryParseVersion(ifMatch, out var expectedVersion))
            return PreconditionRequired();

        var result = await sender.Send(new RequestObjectivePlanChangesCommand(
            cycleId,
            planId,
            expectedVersion,
            request.Comment,
            request.ReferencedObjectiveIds), cancellationToken);

        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<PlanApprovalReviewDto>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(error.Message));

        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            return NotFound(ApiResponse.Failure(error.Message));

        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase)
            || error.Code.Contains("Invalid", StringComparison.OrdinalIgnoreCase))
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
