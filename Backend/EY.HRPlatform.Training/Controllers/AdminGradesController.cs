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
[Route("api/training/admin/grades")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminGradesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminGradesController> _logger;

    public AdminGradesController(ISender sender, ILogger<AdminGradesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all grades ordered by level.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<GradeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetGradesQuery(), cancellationToken);
            return Ok(ApiResponse<List<GradeDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve grades");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving grades."));
        }
    }

    /// <summary>Create a new grade.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateGradeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateGradeCommand(request.Name, request.Level, request.Description, request.Icon),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("Duplicate"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<Guid>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create grade");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the grade."));
        }
    }

    /// <summary>Update an existing grade.</summary>
    [HttpPut("{gradeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        Guid gradeId, [FromBody] UpdateGradeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateGradeCommand(gradeId, request.Name, request.Level, request.Description, request.Icon),
                cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                if (result.Error.Code.Contains("Duplicate"))
                    return Conflict(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update grade {GradeId}", gradeId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the grade."));
        }
    }

    /// <summary>Delete a grade (only if not assigned to any employee).</summary>
    [HttpDelete("{gradeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid gradeId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new DeleteGradeCommand(gradeId), cancellationToken);

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
            _logger.LogError(ex, "Failed to delete grade {GradeId}", gradeId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the grade."));
        }
    }
}
