using EY.HRPlatform.Performance.Features.Provisioning;
using EY.HRPlatform.SharedKernel.Security;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class InternalPerformanceProvisioningController(
    ISender sender,
    IInternalServiceRequestAuthorizer authorizer) : ControllerBase
{
    [HttpPost("internal/performance/tenants/{tenantId:guid}/provision")]
    public async Task<IActionResult> Provision(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        var result = await sender.Send(new ProvisionTenantCommand(tenantId), cancellationToken);
        if (result.IsFailure)
            return BadRequest(new { error = result.Error.Message });

        return Ok(new
        {
            wasAlreadyProvisioned = result.Value.WasAlreadyProvisioned,
            policyId = result.Value.PolicyId,
            configurationVersionId = result.Value.ConfigurationVersionId
        });
    }
}
