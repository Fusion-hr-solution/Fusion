using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>US-8.1.2 — aggregated feedback dashboards (per-training, per-trainer, global overview).</summary>
[ApiController]
[Route("api/training/admin/feedback")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminFeedbackController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminFeedbackController> _logger;

    public AdminFeedbackController(ISender sender, ILogger<AdminFeedbackController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Per-training feedback summary: ratings, distribution, trend, comments.</summary>
    [HttpGet("training/{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TrainingFeedbackSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrainingFeedback(
        Guid trainingId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetTrainingFeedbackSummaryQuery(trainingId, from, to), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<TrainingFeedbackSummaryDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve feedback for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving training feedback."));
        }
    }

    /// <summary>Per-trainer feedback list (single-trainer attribution).</summary>
    [HttpGet("trainers")]
    [ProducesResponseType(typeof(ApiResponse<List<TrainerFeedbackListItemDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrainers(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetTrainerFeedbackSummaryQuery(from, to), cancellationToken);
            return Ok(ApiResponse<List<TrainerFeedbackListItemDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve trainer feedback list");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving trainer feedback."));
        }
    }

    /// <summary>One trainer's feedback detail. The key (employee id, email or name) is passed as a query param.</summary>
    [HttpGet("trainer")]
    [ProducesResponseType(typeof(ApiResponse<TrainerFeedbackDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrainerDetail(
        [FromQuery] string key,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(ApiResponse.Failure("A trainer key is required."));

        try
        {
            var result = await _sender.Send(new GetTrainerFeedbackDetailQuery(key, from, to), cancellationToken);
            return Ok(ApiResponse<TrainerFeedbackDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve trainer feedback detail for {TrainerKey}", key);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving trainer feedback."));
        }
    }

    /// <summary>Global feedback overview: KPIs, response rate, distribution, trend, top/bottom trainings.</summary>
    [HttpGet("overview")]
    [ProducesResponseType(typeof(ApiResponse<FeedbackOverviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetOverview(
        [FromQuery] Guid? categoryId,
        [FromQuery] string? format,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetFeedbackOverviewQuery(new FeedbackOverviewFilter(categoryId, format, from, to)),
                cancellationToken);
            return Ok(ApiResponse<FeedbackOverviewDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve feedback overview");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the feedback overview."));
        }
    }
}
