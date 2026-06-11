using System.Security.Claims;
using EY.HRPlatform.Interview.Features.Grading.Dtos;
using EY.HRPlatform.Interview.Features.Grading.HumanReview;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Interview.Controllers;

[ApiController]
[Authorize]
[Route("api/interview/grading/review")]
public class GradingReviewController(HumanReviewService reviewService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReviewQueueItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingReviews(CancellationToken cancellationToken)
    {
        var items = await reviewService.GetPendingReviewsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<ReviewQueueItemDto>>.Success(items));
    }

    [HttpPost("{resultId:guid}/approve")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Approve(
        Guid resultId,
        [FromBody] ApproveReviewRequest request,
        CancellationToken cancellationToken)
    {
        // Reviewer identity is taken from the authenticated token, never the request
        // body — the browser cannot spoof who approved a review.
        var reviewerEmail = User.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(reviewerEmail))
            return Unauthorized(ApiResponse.Failure("Authenticated user has no email claim."));

        try
        {
            await reviewService.ApproveAsync(resultId, request.Score, reviewerEmail, cancellationToken);
            return Ok(ApiResponse.Success("Review approved."));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Failure(ex.Message));
        }
    }
}
