using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Feedback.Commands;
using EY.HRPlatform.Training.Features.Feedback.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/feedback")]
[Authorize]
public class FeedbackController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<FeedbackController> _logger;

    public FeedbackController(ISender sender, ILogger<FeedbackController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Submit feedback for a completed training (one per training, immutable).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SubmitFeedback(
        [FromBody] SubmitFeedbackRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(
                new SubmitFeedbackCommand(
                    employeeId,
                    request.TrainingId,
                    request.OverallRating,
                    request.ContentRating,
                    request.RelevanceRating,
                    request.WouldRecommend!.Value,
                    request.TrainerRating,
                    request.Comment,
                    request.Suggestions,
                    request.IsAnonymous,
                    request.Answers.Select(a => new FeedbackCustomAnswer(a.QuestionId, a.Value)).ToList()),
                cancellationToken);

            if (result.IsFailure)
            {
                // Error.Conflict/Validation keep the literal code; Error.NotFound emits "<Entity>.NotFound".
                if (result.Error.Code == "Feedback.AlreadySubmitted")
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.EndsWith(".NotFound", StringComparison.Ordinal))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to submit feedback for training {TrainingId}", request.TrainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while submitting your feedback."));
        }
    }

    /// <summary>The active custom questions to render on a training's feedback form (US-8.1.3).</summary>
    [HttpGet("{trainingId:guid}/questions")]
    [ProducesResponseType(typeof(ApiResponse<List<FeedbackQuestionDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrainingFeedbackQuestions(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetTrainingFeedbackQuestionsQuery(trainingId), cancellationToken);
            return Ok(ApiResponse<List<FeedbackQuestionDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve feedback questions for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the feedback form."));
        }
    }

    /// <summary>Completed trainings the current learner has not yet given feedback for.</summary>
    [HttpGet("pending/me")]
    [ProducesResponseType(typeof(ApiResponse<List<PendingFeedbackDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetMyPendingFeedback(CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetMyPendingFeedbackQuery(employeeId), cancellationToken);
            return Ok(ApiResponse<List<PendingFeedbackDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve pending feedback");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving pending feedback."));
        }
    }
}
