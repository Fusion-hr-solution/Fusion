using EY.HRPlatform.Identity.Features.Notifications;
using EY.HRPlatform.SharedKernel.Notifications;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>
/// The languages and company time zone a module needs to write and time its emails, over the signed internal contract.
/// </summary>
[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/identity/notification-audience")]
public sealed class InternalNotificationAudienceController(
    IInternalServiceRequestAuthorizer authorizer,
    NotificationAudienceReader reader) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<NotificationAudience>> Read(
        [FromBody] NotificationAudienceRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();
        if (request.TenantId == Guid.Empty || request.EmployeeIds is null
            || request.EmployeeIds.Count > NotificationAudienceRequest.MaxEmployees)
            return BadRequest();

        var audience = await reader.ReadAsync(request, cancellationToken);
        return audience is null ? NotFound() : Ok(audience);
    }
}
