using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Reviews.Commands;
using EY.HRPlatform.Performance.Features.Reviews.Dtos;
using EY.HRPlatform.Performance.Features.Reviews.Queries;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/reviews")]
[Authorize]
public sealed class FormalReviewsController(ISender sender) : ControllerBase
{
    [HttpPut("cycles/{cycleId:guid}/definitions/{kind}")]
    public async Task<IActionResult> ConfigureDefinition(
        Guid cycleId,
        string kind,
        [FromBody] ConfigureFormalReviewDefinitionRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<FormalReviewKind>(kind, true, out var reviewKind))
            return BadRequest(ApiResponse.Failure("Unknown formal review kind."));
        var result = await sender.Send(new ConfigureFormalReviewDefinitionCommand(cycleId, reviewKind, request.Name,
            request.Criteria.Select(item => new FormalReviewCriterionDefinitionInput(item.Name, item.Description, item.DisplayOrder)).ToList(),
            request.RatingScaleName,
            request.RatingScaleLevels.Select(item => new FormalRatingScaleLevelDefinitionInput(item.Value, item.Label, item.Description)).ToList()), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    [HttpGet("work-items/{workItemId:guid}")]
    public async Task<IActionResult> GetMyReview(Guid workItemId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetMyFormalReviewQuery(workItemId), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<FormalReviewWorkItemDto>.Success(result.Value));
    }

    [HttpPost("work-items/{workItemId:guid}/submit")]
    public async Task<IActionResult> Submit(Guid workItemId, [FromBody] SubmitFormalReviewRequest request, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new SubmitFormalReviewCommand(workItemId,
            request.Criteria.Select(item => new FormalReviewCriterionResponseInput(item.CriterionSnapshotId, item.Rating, item.Comment)).ToList(),
            request.Narrative, request.EvidenceReference), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    [HttpPost("{reviewId:guid}/finalize")]
    public async Task<IActionResult> Finalize(Guid reviewId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new FinalizeManagerReviewCommand(reviewId), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : NoContent();
    }

    [HttpPost("{reviewId:guid}/corrections")]
    public async Task<IActionResult> RequestCorrection(
        Guid reviewId,
        [FromBody] RequestFormalReviewCorrectionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new RequestFormalReviewCorrectionCommand(reviewId, request.Reason, request.DueAt), cancellationToken);
        return result.IsFailure ? MapFailure(result.Error) : Ok(ApiResponse<Guid>.Success(result.Value));
    }

    private IActionResult MapFailure(Error error)
    {
        if (error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase)) return NotFound(ApiResponse.Failure(error.Message));
        if (error.Code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase)) return Forbid();
        if (error.Code.Contains("Validation", StringComparison.OrdinalIgnoreCase)) return BadRequest(ApiResponse.Failure(error.Message));
        return Conflict(ApiResponse.Failure(error.Message));
    }
}

public sealed record ConfigureFormalReviewDefinitionRequest(
    string Name,
    IReadOnlyList<FormalReviewCriterionDefinitionRequest> Criteria,
    string RatingScaleName,
    IReadOnlyList<FormalRatingScaleLevelDefinitionRequest> RatingScaleLevels);

public sealed record FormalReviewCriterionDefinitionRequest(string Name, string? Description, int DisplayOrder);
public sealed record FormalRatingScaleLevelDefinitionRequest(int Value, string Label, string? Description);
public sealed record SubmitFormalReviewRequest(IReadOnlyList<FormalReviewCriterionResponseRequest> Criteria, string? Narrative, string? EvidenceReference);
public sealed record FormalReviewCriterionResponseRequest(Guid CriterionSnapshotId, int Rating, string? Comment);
public sealed record RequestFormalReviewCorrectionRequest(string Reason, DateTime DueAt);
