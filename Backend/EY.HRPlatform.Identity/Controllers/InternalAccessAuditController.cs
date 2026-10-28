using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>The newest change to a tenant's roles, as Identity's access audit recorded it.</summary>
public sealed record InternalRoleChangeDto(DateTime OccurredAt, string ActorName);

/// <summary>
/// Access-audit reads for Core HR's Settings list (B-107): Roles live in Identity, so Core HR asks here for the
/// section's last change. Signed internal callers only; the tenant comes from the trusted <c>X-Tenant-Id</c> header.
/// </summary>
[ApiController]
[Route("internal/identity/access-audit")]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class InternalAccessAuditController(
    AppIdentityDbContext dbContext,
    IInternalServiceRequestAuthorizer internalAuthorizer) : ControllerBase
{
    /// <summary>Roles created, edited or deleted; who holds a role is Workforce access, not Settings.</summary>
    private const string RoleResource = "AccessProfile";

    [HttpGet("roles/latest")]
    public async Task<ActionResult<ApiResponse<InternalRoleChangeDto?>>> LatestRoleChange(CancellationToken cancellationToken)
    {
        if (!await internalAuthorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();
        if (!Guid.TryParse(Request.Headers["X-Tenant-Id"].ToString(), out var tenantId) || tenantId == Guid.Empty)
            return BadRequest(ApiResponse<InternalRoleChangeDto?>.Failure("A resolved tenant is required."));

        var latest = await dbContext.AccessAuditEvents
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(auditEvent => auditEvent.TenantId == tenantId && auditEvent.ResourceType == RoleResource)
            .OrderByDescending(auditEvent => auditEvent.OccurredAt)
            .Select(auditEvent => new InternalRoleChangeDto(auditEvent.OccurredAt, auditEvent.ActorName))
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(ApiResponse<InternalRoleChangeDto?>.Success(latest));
    }
}
