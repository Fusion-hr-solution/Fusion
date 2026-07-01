using EY.HRPlatform.Identity.Features.Eligibility;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("internal/identity/eligibility")]
public sealed class InternalEligibilityController(
    IInternalServiceRequestAuthorizer authorizer,
    IEligibilityDecisionService eligibilityDecisionService) : ControllerBase
{
    [HttpPost("evaluate")]
    public async Task<ActionResult<EligibilityDecision>> Evaluate(
        [FromBody] EligibilityEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await authorizer.AuthorizeAsync(Request, cancellationToken))
            return Unauthorized();

        return Ok(await eligibilityDecisionService.EvaluateAsync(request, cancellationToken));
    }
}
