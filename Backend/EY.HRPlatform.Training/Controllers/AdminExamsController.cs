using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Features.Admin.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/trainings/{trainingId:guid}/exam")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminExamsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminExamsController> _logger;

    public AdminExamsController(ISender sender, ILogger<AdminExamsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the exam (with questions and options) for a training.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<AdminExamDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetAdminExamDetailQuery(trainingId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse<AdminExamDetailDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve exam for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the exam."));
        }
    }

    /// <summary>Create an exam for a training (one exam per training).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(Guid trainingId, [FromBody] CreateExamRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateExamCommand(trainingId, request.Title, request.Description, request.PassingScore, request.DurationMinutes),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Conflict")) return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create exam for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the exam."));
        }
    }

    /// <summary>Update an exam's metadata.</summary>
    [HttpPut("{examId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid trainingId, Guid examId, [FromBody] UpdateExamRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateExamCommand(trainingId, examId, request.Title, request.Description, request.PassingScore, request.DurationMinutes),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update exam {ExamId}", examId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the exam."));
        }
    }

    /// <summary>Delete an exam and all its questions/attempts.</summary>
    [HttpDelete("{examId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid trainingId, Guid examId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DeleteExamCommand(trainingId, examId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete exam {ExamId}", examId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the exam."));
        }
    }

    /// <summary>Add a question (with options) to the exam.</summary>
    [HttpPost("{examId:guid}/questions")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddQuestion(
        Guid trainingId, Guid examId,
        [FromBody] CreateExamQuestionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var options = request.Options
                .Select(o => new AddExamQuestionOptionItem(o.OptionText, o.IsCorrect))
                .ToList();

            var result = await _sender.Send(
                new AddExamQuestionCommand(trainingId, examId, request.QuestionText, request.Type, request.Points, options, request.Explanation),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add question to exam {ExamId}", examId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the question."));
        }
    }

    /// <summary>Update a question (replaces options).</summary>
    [HttpPut("{examId:guid}/questions/{questionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateQuestion(
        Guid trainingId, Guid examId, Guid questionId,
        [FromBody] UpdateExamQuestionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var options = request.Options
                .Select(o => new AddExamQuestionOptionItem(o.OptionText, o.IsCorrect))
                .ToList();

            var result = await _sender.Send(
                new UpdateExamQuestionCommand(trainingId, examId, questionId, request.QuestionText, request.Type, request.Points, options, request.Explanation),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update question {QuestionId}", questionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the question."));
        }
    }

    /// <summary>Delete a question.</summary>
    [HttpDelete("{examId:guid}/questions/{questionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteQuestion(Guid trainingId, Guid examId, Guid questionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DeleteExamQuestionCommand(trainingId, examId, questionId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete question {QuestionId}", questionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the question."));
        }
    }

    /// <summary>Reorder questions within the exam.</summary>
    [HttpPut("{examId:guid}/questions/reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReorderQuestions(
        Guid trainingId, Guid examId,
        [FromBody] ReorderExamQuestionsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new ReorderExamQuestionsCommand(trainingId, examId, request.QuestionIds), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound")) return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder questions for exam {ExamId}", examId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering questions."));
        }
    }
}
