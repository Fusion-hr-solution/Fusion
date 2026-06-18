using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Calendar.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminCalendarController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<AdminCalendarController> _logger;

    public AdminCalendarController(ISender sender, ILogger<AdminCalendarController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>Admin planning calendar: sessions in a window, filtered by room/status/trainer and audience (service line / grade).</summary>
    [HttpGet("calendar")]
    [ProducesResponseType(typeof(ApiResponse<List<TrainingSessionListItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPlanning(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] Guid? serviceLineId,
        [FromQuery] Guid? gradeId,
        [FromQuery] Guid? trainerEmployeeId,
        [FromQuery] string? room,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        try
        {
            var from = fromUtc ?? DateTime.UtcNow.AddDays(-7);
            var to = toUtc ?? DateTime.UtcNow.AddDays(30);

            var result = await _sender.Send(
                new GetAdminPlanningQuery(from, to, serviceLineId, gradeId, trainerEmployeeId, room, status),
                cancellationToken);

            return Ok(ApiResponse<List<TrainingSessionListItemDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve admin planning calendar");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving the planning calendar."));
        }
    }

    /// <summary>Probe room + trainer conflicts for a candidate session window (warn, never block).</summary>
    [HttpGet("calendar/conflicts")]
    [ProducesResponseType(typeof(ApiResponse<ScheduleConflictResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DetectConflicts(
        [FromQuery] string? room,
        [FromQuery] Guid? trainerEmployeeId,
        [FromQuery] string? trainerEmail,
        [FromQuery] DateTime startUtc,
        [FromQuery] DateTime endUtc,
        [FromQuery] Guid? excludeSessionId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(
                new DetectScheduleConflictsQuery(room, trainerEmployeeId, trainerEmail, startUtc, endUtc, excludeSessionId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(ApiResponse.Failure(result.Error.Message));

            return Ok(ApiResponse<ScheduleConflictResultDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to detect schedule conflicts");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while detecting conflicts."));
        }
    }
}
