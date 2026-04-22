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
[Route("api/training/admin/curriculum")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminCurriculumController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminCurriculumController> _logger;

    public AdminCurriculumController(ISender sender, ILogger<AdminCurriculumController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the curriculum matrix with grades, service lines, and cell counts.</summary>
    [HttpGet("matrix")]
    [ProducesResponseType(typeof(ApiResponse<CurriculumMatrixDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMatrix(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetCurriculumMatrixQuery(), cancellationToken);
            return Ok(ApiResponse<CurriculumMatrixDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve curriculum matrix");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the curriculum matrix."));
        }
    }

    /// <summary>Get the ordered list of mappings for one cell (grade + service line).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<CurriculumMappingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCell(
        [FromQuery] Guid gradeId,
        [FromQuery] Guid serviceLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new GetCurriculumCellQuery(gradeId, serviceLineId), cancellationToken);

            return Ok(ApiResponse<List<CurriculumMappingDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve curriculum cell");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the curriculum cell."));
        }
    }

    /// <summary>Add a training to a curriculum cell.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Add(
        [FromBody] AddCurriculumMappingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new AddCurriculumMappingCommand(
                    request.GradeId, request.ServiceLineId, request.TrainingId,
                    request.IsRequired, request.OrderIndex),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Duplicate"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add curriculum mapping");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while adding the curriculum mapping."));
        }
    }

    /// <summary>Update a curriculum mapping (isRequired toggle).</summary>
    [HttpPut("{mappingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid mappingId,
        [FromBody] UpdateCurriculumMappingRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateCurriculumMappingCommand(mappingId, request.IsRequired),
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
            _logger.LogError(ex, "Failed to update curriculum mapping {MappingId}", mappingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the curriculum mapping."));
        }
    }

    /// <summary>Remove a curriculum mapping.</summary>
    [HttpDelete("{mappingId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Remove(Guid mappingId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new RemoveCurriculumMappingCommand(mappingId), cancellationToken);

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
            _logger.LogError(ex, "Failed to remove curriculum mapping {MappingId}", mappingId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while removing the curriculum mapping."));
        }
    }

    /// <summary>Reorder the mappings within a curriculum cell.</summary>
    [HttpPut("cell/reorder")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reorder(
        [FromBody] ReorderCurriculumCellRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new ReorderCurriculumCellCommand(request.GradeId, request.ServiceLineId, request.MappingIds),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reorder curriculum cell");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while reordering the curriculum cell."));
        }
    }

    /// <summary>Bulk-assign a training to multiple grade/service-line combinations.</summary>
    [HttpPost("bulk")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BulkAssign(
        [FromBody] BulkAssignCurriculumRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new BulkAssignCurriculumCommand(
                    request.TrainingId, request.IsRequired,
                    request.GradeIds, request.ServiceLineIds),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<int>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bulk assign curriculum");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while bulk assigning curriculum."));
        }
    }
}
