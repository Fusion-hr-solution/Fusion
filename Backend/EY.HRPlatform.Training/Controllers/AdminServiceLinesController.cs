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
[Route("api/training/admin/service-lines")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminServiceLinesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminServiceLinesController> _logger;

    public AdminServiceLinesController(ISender sender, ILogger<AdminServiceLinesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all service lines ordered by name.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<ServiceLineDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetServiceLinesQuery(), cancellationToken);
            return Ok(ApiResponse<List<ServiceLineDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve service lines");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving service lines."));
        }
    }

    /// <summary>Create a new service line.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateServiceLineRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new CreateServiceLineCommand(
                    request.Name, request.Code, request.Color,
                    request.Description, request.IsSharedAcrossAllServiceLines),
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
            _logger.LogError(ex, "Failed to create service line");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while creating the service line."));
        }
    }

    /// <summary>Update an existing service line.</summary>
    [HttpPut("{serviceLineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        Guid serviceLineId, [FromBody] UpdateServiceLineRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateServiceLineCommand(
                    serviceLineId, request.Name, request.Code, request.Color,
                    request.Description, request.IsSharedAcrossAllServiceLines),
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
            _logger.LogError(ex, "Failed to update service line {ServiceLineId}", serviceLineId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the service line."));
        }
    }

    /// <summary>Delete a service line (only if not assigned to any employee).</summary>
    [HttpDelete("{serviceLineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid serviceLineId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DeleteServiceLineCommand(serviceLineId), cancellationToken);

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
            _logger.LogError(ex, "Failed to delete service line {ServiceLineId}", serviceLineId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while deleting the service line."));
        }
    }
}
