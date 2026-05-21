using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Parts.Commands;
using EY.HRPlatform.Training.Features.Admin.Parts.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/trainings/{trainingId:guid}/parts")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminTrainingPartsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminTrainingPartsController> _logger;

    public AdminTrainingPartsController(ISender sender, ILogger<AdminTrainingPartsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get all Parts (séances) for a training, ordered by index, with their Sessions.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingPartDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetParts(Guid trainingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetPartsForTrainingQuery(trainingId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse<List<TrainingPartDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve parts for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving training parts."));
        }
    }

    /// <summary>Add a new Part to the training. Order index is auto-assigned to last + 1.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddPart(
        Guid trainingId, [FromBody] CreatePartRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AddPartCommand(trainingId, request.Title, request.Description, request.DurationHours),
                cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return StatusCode(StatusCodes.Status201Created, ApiResponse<Guid>.Success(result.Value));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add part to training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the part."));
        }
    }

    /// <summary>Update a Part's title, description, or duration.</summary>
    [HttpPut("{partId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePart(
        Guid trainingId, Guid partId, [FromBody] UpdatePartRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdatePartCommand(trainingId, partId, request.Title, request.Description, request.DurationHours),
                cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update part {PartId}", partId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the part."));
        }
    }

    /// <summary>Delete a Part. Cascades to its Sessions.</summary>
    [HttpDelete("{partId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeletePart(
        Guid trainingId, Guid partId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DeletePartCommand(trainingId, partId), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete part {PartId}", partId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the part."));
        }
    }

    /// <summary>Reorder all Parts using a complete ordered list of part ids.</summary>
    [HttpPut("reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reorder(
        Guid trainingId, [FromBody] ReorderPartsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new ReorderPartsCommand(trainingId, request.PartIds), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));
            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder parts for training {TrainingId}", trainingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering parts."));
        }
    }

    /// <summary>Lock or unlock a Part, preventing or allowing new session creation.</summary>
    [HttpPut("{partId:guid}/lock")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleLock(
        Guid trainingId, Guid partId, [FromBody] TogglePartLockRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new TogglePartLockCommand(trainingId, partId, request.Lock), cancellationToken);

            if (result.IsFailure)
                return result.Error.Code.EndsWith("NotFound")
                    ? NotFound(ApiResponse.Failure(result.Error.Message))
                    : BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to toggle lock for part {PartId}", partId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while toggling the part lock."));
        }
    }
}
