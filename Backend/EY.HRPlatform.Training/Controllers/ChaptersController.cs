using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Chapters.Queries;
using EY.HRPlatform.Training.Features.MyTrainings.Commands;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/my-trainings/{trainingId:guid}/chapters")]
[Authorize]
public class ChaptersController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<ChaptersController> _logger;

    public ChaptersController(ISender sender, ILogger<ChaptersController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get all chapters with progress for an enrolled training.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<ChapterListItemDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetChapters(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(
                new GetChaptersWithProgressQuery(employeeId, trainingId), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("Enrollment"))
                    return StatusCode(StatusCodes.Status403Forbidden,
                        ApiResponse.Failure(result.Error.Message));

                return NotFound(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<List<ChapterListItemDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve chapters for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving chapters."));
        }
    }

    /// <summary>Get the full content of a specific chapter.</summary>
    [HttpGet("{chapterId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ChapterContentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetChapterContent(
        Guid trainingId,
        Guid chapterId,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(
                new GetChapterContentQuery(employeeId, trainingId, chapterId), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("Enrollment"))
                    return StatusCode(StatusCodes.Status403Forbidden,
                        ApiResponse.Failure(result.Error.Message));

                return NotFound(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<ChapterContentDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve chapter content {ChapterId} for training {TrainingId}",
                chapterId, trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving chapter content."));
        }
    }

    /// <summary>Mark a content block as completed or uncompleted.</summary>
    [HttpPut("{chapterId:guid}/content-blocks/{contentBlockId:guid}/progress")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UpdateProgress(
        Guid trainingId,
        Guid chapterId,
        Guid contentBlockId,
        [FromBody] UpdateChapterProgressRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(
                new UpdateContentBlockProgressCommand(employeeId, trainingId, chapterId, contentBlockId, request.Completed),
                cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update content block progress {ContentBlockId} for chapter {ChapterId}",
                contentBlockId, chapterId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating chapter progress."));
        }
    }
}
