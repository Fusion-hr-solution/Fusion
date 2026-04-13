using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/trainings/{trainingId:guid}/chapters/{chapterId:guid}/content-blocks")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminContentBlocksController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminContentBlocksController> _logger;

    public AdminContentBlocksController(ISender sender, ILogger<AdminContentBlocksController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Add a content block to a chapter.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Add(
        Guid trainingId, Guid chapterId,
        [FromBody] CreateContentBlockRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AddContentBlockCommand(trainingId, chapterId,
                    request.Type, request.OrderIndex, request.Title,
                    request.TextContent, request.ContentUri, request.VideoUrl,
                    request.EstimatedDurationMinutes),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add content block to chapter {ChapterId}", chapterId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the content block."));
        }
    }

    /// <summary>Update a content block.</summary>
    [HttpPut("{contentBlockId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid trainingId, Guid chapterId, Guid contentBlockId,
        [FromBody] UpdateContentBlockRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateContentBlockCommand(trainingId, chapterId, contentBlockId,
                    request.Type, request.Title, request.TextContent,
                    request.ContentUri, request.VideoUrl, request.EstimatedDurationMinutes),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update content block {ContentBlockId}", contentBlockId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the content block."));
        }
    }

    /// <summary>Delete a content block.</summary>
    [HttpDelete("{contentBlockId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid trainingId, Guid chapterId, Guid contentBlockId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteContentBlockCommand(trainingId, chapterId, contentBlockId),
                cancellationToken);

            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete content block {ContentBlockId}", contentBlockId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the content block."));
        }
    }

    /// <summary>Reorder content blocks within a chapter.</summary>
    [HttpPut("reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reorder(
        Guid trainingId, Guid chapterId,
        [FromBody] ReorderContentBlocksRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new ReorderContentBlocksCommand(trainingId, chapterId, request.ContentBlockIds),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder content blocks for chapter {ChapterId}", chapterId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering content blocks."));
        }
    }
}
