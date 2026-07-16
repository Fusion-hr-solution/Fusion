using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/corehr/workforce/snapshots")]
public sealed class InternalWorkforceSnapshotsController(
    IInternalServiceRequestAuthorizer authorizer,
    IInternalWorkforceSnapshotService workforceSnapshotService) : ControllerBase
{
    [HttpPost("resolve")]
    public async Task<ActionResult<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>>> ResolveEmployees(
        [FromBody] InternalWorkforceEmployeeResolveRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await workforceSnapshotService.ResolveEmployeesAsync(
            request.AsOf,
            request.EmployeeIds,
            cancellationToken));
    }

    [HttpPost("by-scope")]
    public async Task<ActionResult<IReadOnlyList<InternalWorkforceEmployeeSnapshotDto>>> GetEmployeesByScope(
        [FromBody] InternalWorkforceEmployeesByScopeRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await workforceSnapshotService.GetEmployeesByScopeAsync(
            request.AsOf,
            request.OrgUnitIds,
            request.IncludeDescendants,
            request.IncludeInactive,
            cancellationToken));
    }
}
