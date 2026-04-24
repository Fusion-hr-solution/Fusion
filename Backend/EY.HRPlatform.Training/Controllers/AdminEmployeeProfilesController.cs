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
[Route("api/training/admin/employee-profiles")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminEmployeeProfilesController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminEmployeeProfilesController> _logger;

    public AdminEmployeeProfilesController(ISender sender, ILogger<AdminEmployeeProfilesController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>List all employee profiles with pagination.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponse<EmployeeProfileDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _sender.Send(
                new GetEmployeeProfilesQuery(page, pageSize), cancellationToken);

            return Ok(ApiResponse<PagedResponse<EmployeeProfileDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve employee profiles");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving employee profiles."));
        }
    }

    /// <summary>
    /// Assign or update a grade and service line for an employee (upsert).
    /// Creates the profile if it does not exist, updates it if it does.
    /// </summary>
    [HttpPut("{employeeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upsert(
        Guid employeeId,
        [FromBody] UpsertEmployeeProfileRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpsertEmployeeProfileCommand(employeeId, request.GradeId, request.ServiceLineId),
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
            _logger.LogError(ex, "Failed to upsert employee profile {EmployeeId}", employeeId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating the employee profile."));
        }
    }
}
