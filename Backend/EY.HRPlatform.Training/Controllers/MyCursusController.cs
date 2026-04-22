using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Cursus.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/cursus")]
[Authorize]
public class MyCursusController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<MyCursusController> _logger;

    public MyCursusController(ISender sender, ILogger<MyCursusController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the authenticated employee's curriculum (Mon Cursus).</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<MyCursusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyCursus(CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var result = await _sender.Send(new GetMyCursusQuery(employeeId), cancellationToken);

            if (result.IsFailure)
            {
                if (result.Error.Code.Contains("NotFound"))
                    return NotFound(ApiResponse.Failure(result.Error.Message));
                return BadRequest(ApiResponse.Failure(result.Error.Message));
            }

            return Ok(ApiResponse<MyCursusDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve employee cursus");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving your cursus."));
        }
    }
}
