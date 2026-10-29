using EY.HRPlatform.CoreHR.Features.Notifications;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// The caller's own Core HR notifications (the Fusion notification contract), their upcoming team and job changes, and
/// their email choice. The recipient is always the caller's own employee record; an account without one has no Core HR
/// news, so it reads as empty.
/// </summary>
[ApiController]
[Authorize]
[Route("api/corehr")]
public sealed class NotificationsController(CoreNotificationFeed feed, ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("notifications")]
    public async Task<ActionResult<ApiResponse<FusionNotificationPageDto>>> List(
        [FromQuery] string? cursor, [FromQuery] int? limit, CancellationToken cancellationToken)
        => Ok(ApiResponse<FusionNotificationPageDto>.Success(User.GetEmployeeId() is { } employeeId
            ? await feed.PageAsync(employeeId, cursor, limit, FusionRequestLanguage.Of(Request), cancellationToken)
            : new FusionNotificationPageDto([], 0, null)));

    [HttpPost("notifications/read")]
    public async Task<ActionResult<ApiResponse<MarkNotificationsReadResultDto>>> MarkRead(
        [FromBody] MarkNotificationsReadRequest request, CancellationToken cancellationToken)
    {
        var all = request.All == true;
        var ids = request.Ids ?? [];
        if (!all && ids.Count == 0 || ids.Count > CoreNotificationFeed.MaxIdsPerRead)
            return BadRequest(ApiResponse<MarkNotificationsReadResultDto>.Failure(
                $"Choose all, or between 1 and {CoreNotificationFeed.MaxIdsPerRead} notifications."));
        return Ok(ApiResponse<MarkNotificationsReadResultDto>.Success(User.GetEmployeeId() is { } employeeId
            ? await feed.MarkReadAsync(employeeId, ids, all, cancellationToken)
            : new MarkNotificationsReadResultDto(0)));
    }

    /// <summary>The live nudge (B-002 N9): "your feed changed", no content, open only as long as the caller's token.</summary>
    [HttpGet("notifications/stream")]
    public async Task Stream([FromServices] FeedNudgeHub hub, [FromServices] ITenantContext tenant, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved || User.GetEmployeeId() is not { } employeeId)
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        using var subscription = hub.Subscribe(new FeedRecipient(tenant.TenantId, employeeId, null));
        if (subscription is null)
        {
            Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return;
        }
        var expires = long.TryParse(User.FindFirst("exp")?.Value, out var seconds) ? DateTimeOffset.FromUnixTimeSeconds(seconds) : (DateTimeOffset?)null;
        await FeedNudgeStream.RunAsync(HttpContext, subscription, expires, TimeProvider.System, cancellationToken);
    }

    /// <summary>
    /// One-click unsubscribe (RFC 8058) from an email's header: turns off team and job change email for the person the
    /// signed link names. Mail apps POST it without a session; a GET (link scanners) changes nothing.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("notifications/unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromQuery] string? token, CancellationToken cancellationToken)
        => await feed.UnsubscribeAsync(token, cancellationToken) ? Ok() : BadRequest();

    [HttpGet("upcoming")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FusionUpcomingDto>>>> Upcoming(
        [FromQuery] int days = 14, CancellationToken cancellationToken = default)
    {
        if (days is < 1 or > CoreNotificationFeed.MaxUpcomingDays)
            return BadRequest(ApiResponse<IReadOnlyList<FusionUpcomingDto>>.Failure(
                $"Choose between 1 and {CoreNotificationFeed.MaxUpcomingDays} days."));
        return Ok(ApiResponse<IReadOnlyList<FusionUpcomingDto>>.Success(User.GetEmployeeId() is { } employeeId
            ? await feed.UpcomingAsync(employeeId, days, FusionRequestLanguage.Of(Request), cancellationToken)
            : []));
    }

    [HttpGet("notification-preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> GetPreferences(CancellationToken cancellationToken)
        => User.GetEmployeeId() is { } employeeId
            ? Ok(ApiResponse<NotificationPreferencesDto>.Success(
                await feed.PreferencesAsync(employeeId, accessPolicy.CanViewTeam(User), cancellationToken)))
            : Forbid();

    [HttpPut("notification-preferences")]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> UpdatePreferences(
        [FromBody] UpdateNotificationPreferencesRequest request, CancellationToken cancellationToken)
    {
        if (User.GetEmployeeId() is not { } employeeId) return Forbid();
        var (value, refusal) = await feed.UpdatePreferencesAsync(employeeId, accessPolicy.CanViewTeam(User), request, cancellationToken);
        return refusal switch
        {
            PreferencesRefusal.Changed => Conflict(ApiResponse<NotificationPreferencesDto>.Failure(
                "Your notification settings changed somewhere else. Reload and try again.")),
            PreferencesRefusal.Invalid => BadRequest(ApiResponse<NotificationPreferencesDto>.Failure(
                "Only team and job change email can be turned off.")),
            _ => Ok(ApiResponse<NotificationPreferencesDto>.Success(value!)),
        };
    }
}
