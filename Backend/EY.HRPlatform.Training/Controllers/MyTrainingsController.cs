using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Features.MyTrainings.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/my-trainings")]
[Authorize]
public class MyTrainingsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<MyTrainingsController> _logger;

    public MyTrainingsController(ISender sender, ILogger<MyTrainingsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get all trainings enrolled by the current user.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<MyTrainingDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetMyTrainings(
        [FromQuery] TrainingStatus? status,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetMyTrainingsQuery(employeeId, status), cancellationToken);
            return Ok(ApiResponse<List<MyTrainingDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve enrolled trainings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving your trainings."));
        }
    }

    /// <summary>Get progress details for a specific enrolled training.</summary>
    [HttpGet("{trainingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<MyTrainingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetTrainingProgress(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetMyTrainingProgressQuery(employeeId, trainingId), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<MyTrainingDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve training progress for {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving training progress."));
        }
    }

    /// <summary>Self-enroll in a training.</summary>
    [HttpPost("enroll")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Enroll([FromBody] EnrollRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new EnrollCommand(employeeId, request.TrainingId), cancellationToken);

            if (result.IsFailure)
            {
                return result.Error.Code.Contains("Conflict")
                    ? Conflict(ApiResponse.Failure(result.Error.Message))
                    : NotFound(ApiResponse.Failure(result.Error.Message));
            }

            return CreatedAtAction(
                nameof(GetTrainingProgress),
                new { trainingId = request.TrainingId },
                ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enroll in training {TrainingId}", request.TrainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while enrolling in the training."));
        }
    }

    /// <summary>Update progress for a specific chapter.</summary>
    [HttpPut("{trainingId:guid}/chapters/progress")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UpdateChapterProgress(
        Guid trainingId,
        [FromBody] UpdateChapterProgressRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(
                new UpdateChapterProgressCommand(employeeId, trainingId, request.ChapterId, request.Completed),
                cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update chapter progress for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating chapter progress."));
        }
    }
}
