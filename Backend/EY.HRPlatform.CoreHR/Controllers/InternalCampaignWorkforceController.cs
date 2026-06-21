using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

public sealed record CampaignWorkforceContextRequest(DateTime AsOf);
public sealed record CampaignWorkforceDeltaRequest(DateTime AsOf, string BaselineSourceVersion);

[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/corehr/campaign-workforce")]
public sealed class InternalCampaignWorkforceController(
    IInternalServiceRequestAuthorizer authorizer,
    ICampaignWorkforceContextService workforceContextService) : ControllerBase
{
    [HttpPost("context")]
    public async Task<ActionResult<CampaignWorkforceContext>> GetContext(
        [FromBody] CampaignWorkforceContextRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await workforceContextService.GetAsync(request.AsOf, cancellationToken));
    }

    [HttpPost("delta")]
    public async Task<ActionResult<CampaignWorkforceContext>> GetDelta(
        [FromBody] CampaignWorkforceDeltaRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await workforceContextService.GetDeltaAsync(
            request.AsOf,
            request.BaselineSourceVersion,
            cancellationToken));
    }
}
