using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Calendar.Reminders.Commands;
using EY.HRPlatform.Training.Features.Calendar.Reminders.Queries;
using EY.HRPlatform.Training.Models.Requests;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminReminderSettingsController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminReminderSettingsController> _logger;

    public AdminReminderSettingsController(ISender sender, ILogger<AdminReminderSettingsController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Get the global session-reminder policy.</summary>
    [HttpGet("reminder-settings")]
    [ProducesResponseType(typeof(ApiResponse<ReminderSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetReminderSettingsQuery(), cancellationToken);
            return Ok(ApiResponse<ReminderSettingsDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get reminder settings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving reminder settings."));
        }
    }

    /// <summary>Update the global session-reminder policy (enabled + lead-time offsets in minutes).</summary>
    [HttpPut("reminder-settings")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update([FromBody] UpdateReminderSettingsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new UpdateReminderSettingsCommand(request.Enabled, request.OffsetsMinutes), cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse.Success());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update reminder settings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while updating reminder settings."));
        }
    }
}
