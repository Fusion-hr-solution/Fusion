using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>
/// Which active accounts of a tenant hold a permission. Lets a service verify a user it is
/// asked to name by capability, since it can only read the caller's own token.
/// </summary>
[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/identity/access")]
public sealed class InternalPermissionHoldersController(
    IInternalServiceRequestAuthorizer authorizer,
    IAccessProfileService accessProfiles) : ControllerBase
{
    [HttpPost("permission-holders")]
    public async Task<ActionResult<IReadOnlyList<PermissionHolder>>> PermissionHolders(
        [FromBody] PermissionHoldersRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();
        if (request.TenantId == Guid.Empty
            || !PermissionCatalog.IsKnown(request.PermissionKey)
            || !PermissionCatalog.IsValidScope(request.PermissionKey, request.Scope))
            return BadRequest();

        return Ok(await accessProfiles.GetPermissionHoldersAsync(
            request.TenantId, request.PermissionKey, request.Scope, cancellationToken));
    }
}
