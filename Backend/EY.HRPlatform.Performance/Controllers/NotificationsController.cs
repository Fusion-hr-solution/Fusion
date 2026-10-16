using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
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
        => MapResult(await mediator.Send(new GetNotificationsQuery(Recipient(), cursor, limit), cancellationToken));

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

    private NotificationRecipient Recipient() => new(User.GetEmployeeId(), User.GetUserId());
}
