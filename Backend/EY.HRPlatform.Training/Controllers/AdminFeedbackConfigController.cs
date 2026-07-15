using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Feedback.Commands;
using EY.HRPlatform.Training.Features.Feedback.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

/// <summary>US-8.1.3 — admin custom feedback-form builder (questions per training category).</summary>
[ApiController]
[Route("api/training/admin/feedback/questions")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminFeedbackConfigController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminFeedbackConfigController> _logger;

    public AdminFeedbackConfigController(ISender sender, ILogger<AdminFeedbackConfigController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Active questions for a category (omit categoryId for the default form).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<FeedbackQuestionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetQuestions([FromQuery] Guid? categoryId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetFeedbackQuestionsQuery(categoryId), cancellationToken);
            return Ok(ApiResponse<List<FeedbackQuestionDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve feedback questions");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving feedback questions."));
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateFeedbackQuestionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateFeedbackQuestionCommand(request.CategoryId, request.Type, request.Label, request.Options),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create feedback question");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the question."));
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateFeedbackQuestionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new UpdateFeedbackQuestionCommand(id, request.Label, request.Options), cancellationToken);

            if (result.IsFailure)
            {
                return result.Error.Code.EndsWith(".NotFound", StringComparison.Ordinal)
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update feedback question {QuestionId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the question."));
        }
    }

    /// <summary>Soft-retire a question (append-only; never hard-deleted — ADR 0006).</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Retire(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new RetireFeedbackQuestionCommand(id), cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retire feedback question {QuestionId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while removing the question."));
        }
    }

    [HttpPost("reorder")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reorder([FromBody] ReorderFeedbackQuestionsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await _sender.Send(new ReorderFeedbackQuestionsCommand(request.QuestionIds), cancellationToken);
            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder feedback questions");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering questions."));
        }
    }
}
