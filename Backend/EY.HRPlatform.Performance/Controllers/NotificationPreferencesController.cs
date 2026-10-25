using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The caller's own email choices for Performance notifications (B-071 D8). There is no address for anyone
/// else's: the recipient is always the caller, resolved as the notification feed resolves it.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/notification-preferences")]
public sealed class NotificationPreferencesController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> Get(CancellationToken cancellationToken)
        => MapResult(await mediator.Send(new GetNotificationPreferencesQuery(Recipient(), Audience(), AccountEmail()), cancellationToken));

    [HttpPut]
    public async Task<ActionResult<ApiResponse<NotificationPreferencesDto>>> Update(
        [FromBody] UpdateNotificationPreferencesRequest request, CancellationToken cancellationToken)
        => MapResult(await mediator.Send(
            new UpdateNotificationPreferencesCommand(Recipient(), Audience(), AccountEmail(), request), cancellationToken));

    private NotificationRecipient Recipient()
        => new(User.GetEmployeeId(), User.GetUserId() is var userId && userId != Guid.Empty ? userId : null);

    private NotificationAudience Audience() => new(policy.CanReviewDirectReports(User), policy.CanCalibrateReviews(User));

    private string? AccountEmail() => User.GetEmail() is { Length: > 0 } email ? email : null;
}
