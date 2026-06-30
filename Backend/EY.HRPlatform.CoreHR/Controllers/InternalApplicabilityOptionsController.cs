using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/corehr/applicability-options")]
public sealed class InternalApplicabilityOptionsController(
    IInternalServiceRequestAuthorizer authorizer,
    IApplicabilityOptionsService applicabilityOptionsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApplicabilityOptionsDto>> Get(CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await applicabilityOptionsService.GetAsync(cancellationToken));
    }
}
