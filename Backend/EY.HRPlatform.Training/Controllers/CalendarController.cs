using System.Text;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Calendar.Commands;
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

    /// <summary>Subscribable ICS feed for the learner that owns the opaque token. Anonymous (token in URL).</summary>
    [HttpGet("me.ics")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyCalendarFeed([FromQuery] string? token, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new GetMyCalendarIcsQuery(token), cancellationToken);
            if (result.IsFailure)
                return NotFound();

            // The feed token rides in the URL; blunt proxy/Referer/cache leakage of the response.
            Response.Headers.CacheControl = "no-store";
            Response.Headers["Referrer-Policy"] = "no-referrer";
            Response.Headers.ContentDisposition = "inline; filename=\"ey-academy.ics\"";
            return File(Encoding.UTF8.GetBytes(result.Value!), "text/calendar; charset=utf-8");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build calendar feed");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while building the calendar feed."));
        }
    }

    /// <summary>Issue or rotate the learner's feed token; returns the new subscribe URL (shown once).</summary>
    [HttpPost("me/feed-token/rotate")]
    [ProducesResponseType(typeof(ApiResponse<CalendarFeedSubscriptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RotateFeedToken(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sender.Send(new RotateCalendarFeedTokenCommand(User.GetUserId()), cancellationToken);
            return Ok(ApiResponse<CalendarFeedSubscriptionDto>.Success(result.Value!));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to rotate calendar feed token");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while rotating your calendar feed link."));
        }
    }

    /// <summary>Download a single session as an .ics file ("Add to calendar"). Requires authentication.</summary>
    [HttpGet("/api/training/sessions/{sessionId:guid}/calendar.ics")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSessionIcs(Guid sessionId, CancellationToken cancellationToken)
    {
        try
        {
            var isAdmin = User.IsInRole(PlatformRole.PlatformAdmin) || User.IsInRole(PlatformRole.HRAdmin);
            var result = await _sender.Send(new GetSessionIcsQuery(sessionId, User.GetUserId(), isAdmin), cancellationToken);
            if (result.IsFailure)
                return NotFound(ApiResponse.Failure(result.Error.Message));

            return File(Encoding.UTF8.GetBytes(result.Value!), "text/calendar; charset=utf-8", "session.ics");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build session ICS for {SessionId}", sessionId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while building the calendar file."));
        }
    }
}
