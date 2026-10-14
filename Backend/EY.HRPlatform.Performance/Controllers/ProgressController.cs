using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Progress recording and evidence under a Cycle: the accountable owner submits measurement-specific,
/// append-only updates with optional evidence; evidence files stage through an upload and download
/// only where named-detail authorization holds. The controller checks the obvious capability first; the
/// handlers enforce owner-only recording and named-detail evidence exposure.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/cycles/{cycleId:guid}")]
public sealed class ProgressController(IMediator mediator, IPerformanceAccessPolicyService policy, IPerformanceEvidenceStore evidence)
    : PerformanceControllerBase
{
    private ProgressActorContext Actor => new(
        User.GetEmployeeId() ?? Guid.Empty,
        policy.CanAdministerCycles(User),
        policy.CanReviewDirectReports(User),
        policy.CanManageOrganizationalObjectives(User),
        policy.CanPublishStrategy(User));

    private const long MaxEvidenceBytes = 20 * 1024 * 1024;

    [HttpGet("objectives/{objectiveId:guid}/progress")]
    public async Task<ActionResult<ApiResponse<ObjectiveProgressDto>>> Get(Guid cycleId, Guid objectiveId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetObjectiveProgressQuery(cycleId, objectiveId, Actor), cancellationToken));
    }

    [HttpGet("objectives/{objectiveId:guid}/progress/history")]
    public async Task<ActionResult<ApiResponse<ProgressHistoryPageDto>>> History(
        Guid cycleId, Guid objectiveId, [FromQuery] string? cursor, [FromQuery] int? limit, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new GetProgressHistoryPageQuery(cycleId, objectiveId, cursor, limit ?? 0, Actor), cancellationToken));
    }

    [HttpPost("objectives/{objectiveId:guid}/progress")]
    public async Task<ActionResult<ApiResponse<ObjectiveProgressDto>>> Submit(
        Guid cycleId, Guid objectiveId, [FromBody] SubmitProgressRequest request, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new SubmitProgressCommand(cycleId, objectiveId, request, Actor), cancellationToken));
    }

    [HttpPost("objectives/{objectiveId:guid}/evidence/uploads")]
    [RequestSizeLimit(MaxEvidenceBytes + 4096)]
    public async Task<ActionResult<ApiResponse<EvidenceDescriptorDto>>> UploadEvidence(Guid cycleId, Guid objectiveId,
        IFormFile file, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        return MapResult(await mediator.Send(new UploadEvidenceCommand(cycleId, objectiveId, file, Actor), cancellationToken));
    }

    [HttpGet("evidence/{evidenceId:guid}")]
    public async Task<IActionResult> DownloadEvidence(Guid cycleId, Guid evidenceId, CancellationToken cancellationToken)
    {
        if (!policy.CanEnterPerformance(User)) return CapabilityForbidden();
        var result = await mediator.Send(new ResolveEvidenceFileQuery(cycleId, evidenceId, Actor), cancellationToken);
        if (result.IsFailure)
        {
            return StatusCode(StatusFor(result.Error), ApiResponse.Failure(result.Error.Message, EY.HRPlatform.Performance.Features.Failures.PerformanceErrors.Details(result.Error)));
        }

        var stream = await evidence.OpenAsync(result.Value.StorageKey, cancellationToken);
        if (stream is null) return NotFound();
        return File(stream, result.Value.ContentType, result.Value.FileName);
    }
}
