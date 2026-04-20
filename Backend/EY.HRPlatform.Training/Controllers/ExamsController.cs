using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Exams.Commands;
using EY.HRPlatform.Training.Features.Exams.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/my-trainings/{trainingId:guid}/exam")]
[Authorize]
public class ExamsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<ExamsController> _logger;

    public ExamsController(ISender sender, ILogger<ExamsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the exam for the current learner (questions without correct answers).
    /// Available only when all chapters are completed.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<ExamForLearnerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetExamForLearnerQuery(employeeId, trainingId), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("Locked"))
                    return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Enrollment"))
                    return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(result.Error.Message));
                return NotFound(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<ExamForLearnerDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve exam for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the exam."));
        }
    }

    /// <summary>Submit exam answers. On pass, the training is marked completed.</summary>
    [HttpPost("submit")]
    [ProducesResponseType(typeof(ApiResponse<ExamSubmissionResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(
        Guid trainingId,
        [FromBody] SubmitExamRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();

            var answers = request.Answers
                .Select(a => new SubmitExamAnswer(a.QuestionId, a.SelectedOptionIds ?? []))
                .ToList();

            var result = await _sender.Send(
                new SubmitExamCommand(employeeId, trainingId, answers), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Locked")) return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<ExamSubmissionResultDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to submit exam for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while submitting the exam."));
        }
    }

    /// <summary>Get the current learner's attempt history for this training.</summary>
    [HttpGet("attempts")]
    [ProducesResponseType(typeof(ApiResponse<List<ExamAttemptDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyAttempts(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetMyExamAttemptsQuery(employeeId, trainingId), cancellationToken);
            return Ok(ApiResponse<List<ExamAttemptDto>>.Success(result.Value ?? []));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve exam attempts for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving exam attempts."));
        }
    }
}
