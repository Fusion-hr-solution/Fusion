using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.Setup;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>Whether CoreHR's foundation (organization + workforce) is established and sound.</summary>
[ApiController]
[Route("api/corehr/setup")]
[Authorize]
public sealed class SetupReadinessController(ICoreHRReadinessService readiness, ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet("readiness")]
    public async Task<ActionResult<ApiResponse<CoreHRReadinessDto>>> Get(CancellationToken cancellationToken)
    {
        if (!accessPolicy.CanViewSetup(User)) return Forbid();
        return Ok(ApiResponse<CoreHRReadinessDto>.Success(await readiness.GetAsync(cancellationToken)));
    }
}
