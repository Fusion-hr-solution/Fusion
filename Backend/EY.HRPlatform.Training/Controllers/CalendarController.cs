using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Calendar.Queries;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly ISender _sender;
    private readonly ILogger<CalendarController> _logger;

    public CalendarController(ISender sender, ILogger<CalendarController> logger)
    {
        _sender = sender;
        _logger = logger;
    }

    /// <summary>The signed-in learner's calendar events (enrolled sessions + deadline markers) in a window.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<List<CalendarEventDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyCalendar(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        try
        {
            var employeeId = User.GetUserId();
            var from = fromUtc ?? DateTime.UtcNow.AddDays(-7);
            var to = toUtc ?? DateTime.UtcNow.AddDays(60);

            var result = await _sender.Send(new GetMyCalendarQuery(employeeId, from, to), cancellationToken);
            return Ok(ApiResponse<List<CalendarEventDto>>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve learner calendar");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while retrieving your calendar."));
        }
    }
}
