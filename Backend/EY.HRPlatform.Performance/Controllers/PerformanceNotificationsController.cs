using EY.HRPlatform.Performance.Features.Notifications.Commands;
using EY.HRPlatform.Performance.Features.Notifications.Dtos;
using EY.HRPlatform.Performance.Features.Notifications.Queries;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/notifications")]
[Authorize]
public class PerformanceNotificationsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMine(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(new GetMyNotificationsQuery(unreadOnly, page, pageSize), cancellationToken);
        return Ok(ApiResponse<PagedResponse<PerformanceNotificationDto>>.Success(result));
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken cancellationToken)
    {
        var count = await sender.Send(new GetUnreadNotificationCountQuery(), cancellationToken);
        return Ok(ApiResponse<int>.Success(count));
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new MarkNotificationReadCommand(id), cancellationToken);
        return result.IsFailure
            ? NotFound(ApiResponse.Failure(result.Error.Message))
            : NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await sender.Send(new MarkAllNotificationsReadCommand(), cancellationToken);
        return NoContent();
    }
}
