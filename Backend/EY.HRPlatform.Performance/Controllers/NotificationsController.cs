using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Notifications;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>The caller's own in-app Performance notifications (the Fusion notification contract).</summary>
[ApiController]
[Authorize]
[Route("api/performance/notifications")]
public sealed class NotificationsController(IMediator mediator) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<FusionNotificationPageDto>>> List(
        [FromQuery] string? cursor, [FromQuery] int? limit, CancellationToken cancellationToken)
        => MapResult(await mediator.Send(new GetNotificationsQuery(Recipient(), cursor, limit, FusionRequestLanguage.Of(Request)),
            cancellationToken));

    /// <summary>
    /// The live nudge (B-002 N9): "your feed changed" whenever a notification for the caller is added or read, so the
    /// shell refetches through the endpoints above. Carries no content; open only as long as the caller's token.
    /// </summary>
    [HttpGet("stream")]
    public async Task Stream([FromServices] FeedNudgeHub hub, [FromServices] ITenantContext tenant, CancellationToken cancellationToken)
    {
        var recipient = Recipient();
        if (!tenant.IsResolved || (recipient.EmployeeId is null && recipient.UserId is null))
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        using var subscription = hub.Subscribe(new FeedRecipient(tenant.TenantId, recipient.EmployeeId, recipient.UserId));
        if (subscription is null)
        {
            Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return;
        }
        var expires = long.TryParse(User.FindFirst("exp")?.Value, out var seconds) ? DateTimeOffset.FromUnixTimeSeconds(seconds) : (DateTimeOffset?)null;
        await FeedNudgeStream.RunAsync(HttpContext, subscription, expires, TimeProvider.System, cancellationToken);
    }

    /// <summary>
    /// One-click unsubscribe (RFC 8058) from an email's header: turns off the one group the signed link names. Mail
    /// apps POST it without a session; a GET (link scanners) changes nothing.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromQuery] string? token, CancellationToken cancellationToken)
        => (await mediator.Send(new UnsubscribeFromEmailGroupCommand(token), cancellationToken)).IsSuccess ? Ok() : BadRequest();

    [HttpPost("read")]
    public async Task<ActionResult<ApiResponse<MarkNotificationsReadResultDto>>> MarkRead(
        [FromBody] MarkNotificationsReadRequest request, CancellationToken cancellationToken)
    {
        var all = request.All == true;
        var ids = request.Ids ?? [];
        if (!all && ids.Count == 0 || ids.Count > NotificationFeed.MaxIdsPerRead)
            return MapResult(Result.Failure<MarkNotificationsReadResultDto>(PerformanceErrors.Validation(
                "Notifications.ReadInvalid", $"Choose all, or between 1 and {NotificationFeed.MaxIdsPerRead} notifications.")));
        return MapResult(await mediator.Send(new MarkNotificationsReadCommand(Recipient(), ids, all), cancellationToken));
    }

    private NotificationRecipient Recipient()
        => new(User.GetEmployeeId(), User.GetUserId() is var userId && userId != Guid.Empty ? userId : null);
}
