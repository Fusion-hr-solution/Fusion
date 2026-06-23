using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.ConfigureFeedbackTemplate;
using EY.HRPlatform.Performance.Features.Feedback.Commands.FinalizeFeedbackWindow;
using EY.HRPlatform.Performance.Features.Feedback.Commands.InvalidateFeedbackResponse;
using EY.HRPlatform.Performance.Features.Feedback.Commands.ReviseFeedbackResponse;
using EY.HRPlatform.Performance.Features.Feedback.Commands.ResolveFeedbackIdentity;
using EY.HRPlatform.Performance.Features.Feedback.Commands.SubmitFeedbackResponse;
using EY.HRPlatform.Performance.Features.Feedback.Commands.WithdrawFeedbackResponse;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackResponses;
using EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackThresholdStatus;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/feedback")]
[Authorize]
public sealed class FeedbackController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Configure a frozen feedback template for a cycle and type.
    /// </summary>
    [HttpPut("cycles/{cycleId:guid}/templates/{feedbackType}")]
    public async Task<IActionResult> ConfigureTemplate(
        Guid cycleId,
        string feedbackType,
        [FromBody] ConfigureFeedbackTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new ConfigureFeedbackTemplateCommand(
                cycleId,
                feedbackType,
                request.Name,
                request.Prompts.Select(p => new FeedbackPromptDefinitionInput(
                    p.PromptText, p.Description, p.IsRequired, p.DisplayOrder)).ToList()),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    /// <summary>
    /// Get anonymized feedback responses for a subject cohort.
    /// </summary>
    [HttpGet("cycles/{cycleId:guid}/subjects/{subjectId:guid}/responses")]
    public async Task<IActionResult> GetFeedbackResponses(
        Guid cycleId,
        Guid subjectId,
        [FromQuery] string feedbackType,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<CampaignWorkItemType>(feedbackType, ignoreCase: true, out var parsedType) ||
            parsedType is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
        {
            return BadRequest(ApiResponse.Failure("Feedback type must be PeerFeedback or UpwardFeedback."));
        }

        var result = await sender.Send(
            new GetFeedbackResponsesQuery(cycleId, subjectId, parsedType),
            cancellationToken);
        return result.IsFailure
            ? MapFailure(result.Error)
            : Ok(ApiResponse<FeedbackResponseListDto>.Success(result.Value));
    }

    /// <summary>
    /// Get the reviewer's own feedback response for a work item (for revising/withdrawing).
    /// </summary>
    [HttpGet("work-items/{workItemId:guid}")]
    public async Task<IActionResult> GetMyFeedback(
        Guid workItemId,
        CancellationToken cancellationToken)
    {
        // This endpoint is for the reviewer to see their own response.
        // For subject/manager reading anonymized responses, use GetFeedbackResponses.
        // NOTE: The actual implementation requires a dedicated GetMyFeedbackQuery handler.
        // For now, return a 404 indicating the query handler is not yet wired.
        return NotFound(ApiResponse.Failure("GetMyFeedback query handler not yet implemented."));
    }

    /// <summary>
    /// Submit a feedback response for a work item.
    /// </summary>
    [HttpPost("work-items/{workItemId:guid}/submit")]
    public async Task<IActionResult> Submit(
        Guid workItemId,
        [FromBody] SubmitFeedbackResponseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new SubmitFeedbackResponseCommand(
                workItemId,
                request.Answers.Select(a => new FeedbackAnswerInput(a.PromptSnapshotId, a.AnswerText)).ToList(),
                request.GeneralComment),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    /// <summary>
    /// Revise a submitted feedback response (append-only version history).
    /// </summary>
    [HttpPost("responses/{responseId:guid}/revise")]
    public async Task<IActionResult> Revise(
        Guid responseId,
        [FromBody] ReviseFeedbackResponseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new ReviseFeedbackResponseCommand(
                responseId,
                request.Answers.Select(a => new FeedbackAnswerInput(a.PromptSnapshotId, a.AnswerText)).ToList(),
                request.GeneralComment),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    /// <summary>
    /// Withdraw a submitted feedback response (soft withdrawal to Draft status).
    /// </summary>
    [HttpPost("responses/{responseId:guid}/withdraw")]
    public async Task<IActionResult> Withdraw(
        Guid responseId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new WithdrawFeedbackResponseCommand(responseId),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    /// <summary>
    /// Administratively invalidate a feedback response with mandatory reason.
    /// </summary>
    [HttpPost("responses/{responseId:guid}/invalidate")]
    public async Task<IActionResult> Invalidate(
        Guid responseId,
        [FromBody] InvalidateFeedbackResponseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new InvalidateFeedbackResponseCommand(responseId, request.Reason),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    /// <summary>
    /// Get threshold status for a feedback cohort (per-cycle + per-subject + per-type).
    /// D-09: CurrentCount visibility restricted for non-admin consumers when below threshold.
    /// </summary>
    [HttpGet("cycles/{cycleId:guid}/subjects/{subjectId:guid}/threshold")]
    public async Task<IActionResult> GetThresholdStatus(
        Guid cycleId,
        Guid subjectId,
        [FromQuery] string feedbackType,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<CampaignWorkItemType>(feedbackType, ignoreCase: true, out var parsedType) ||
            parsedType is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
            {
                return BadRequest(ApiResponse.Failure("Feedback type must be PeerFeedback or UpwardFeedback."));
            }

        var result = await sender.Send(
            new GetFeedbackThresholdStatusQuery(cycleId, subjectId, parsedType),
            cancellationToken);
        if (result.IsFailure)
            return MapFailure(result.Error);

        // D-09: Suppress CurrentCount when below threshold for non-admin consumers.
        // Admin/HR (CanManageCycles) see full status; subject/manager/owner see only flags.
        var dto = result.Value;
        if (dto.IsSuppressed && !User.IsInRole("PlatformAdmin") &&
            !User.HasClaim("core_permission", "CycleManage:Tenant"))
        {
            dto = dto with { CurrentCount = 0 }; // Hide exact count from non-admin
        }

        return Ok(ApiResponse<FeedbackThresholdStatusDto>.Success(dto));
    }

    /// <summary>
    /// Resolve feedback identity for exceptional compliance purposes.
    /// Requires ConfidentialIdentityView permission; every access emits audit event.
    /// </summary>
    [HttpPost("responses/{responseId:guid}/resolve-identity")]
    public async Task<IActionResult> ResolveIdentity(
        Guid responseId,
        [FromBody] ResolveFeedbackIdentityRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new ResolveFeedbackIdentityCommand(responseId, request.Reason),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<FeedbackIdentityDto>.Success(result.Value));
    }

    /// <summary>
    /// Finalize the feedback window — locks all submitted responses and evaluates final threshold.
    /// </summary>
    [HttpPost("cycles/{cycleId:guid}/finalize")]
    public async Task<IActionResult> FinalizeWindow(
        Guid cycleId,
        [FromQuery] string feedbackType,
        [FromQuery] Guid subjectId,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<CampaignWorkItemType>(feedbackType, ignoreCase: true, out var parsedType) ||
            parsedType is not (CampaignWorkItemType.PeerFeedback or CampaignWorkItemType.UpwardFeedback))
            {
                return BadRequest(ApiResponse.Failure("Feedback type must be PeerFeedback or UpwardFeedback."));
            }

        var result = await sender.Send(
            new FinalizeFeedbackWindowCommand(cycleId, feedbackType, subjectId),
            cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase)) return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase)) return Forbid();
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase)) return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }
}

// ─── Request records ───────────────────────────────────────────────────────

public sealed record ConfigureFeedbackTemplateRequest(
    string Name,
    IReadOnlyList<FeedbackPromptDefinitionRequest> Prompts);

public sealed record FeedbackPromptDefinitionRequest(
    string PromptText,
    string? Description,
    bool IsRequired,
    int DisplayOrder);

public sealed record SubmitFeedbackResponseRequest(
    IReadOnlyList<FeedbackAnswerRequest> Answers,
    string? GeneralComment);

public sealed record FeedbackAnswerRequest(
    Guid PromptSnapshotId,
    string AnswerText);

public sealed record ReviseFeedbackResponseRequest(
    IReadOnlyList<FeedbackAnswerRequest> Answers,
    string? GeneralComment);

public sealed record InvalidateFeedbackResponseRequest(string Reason);

public sealed record ResolveFeedbackIdentityRequest(string Reason);
