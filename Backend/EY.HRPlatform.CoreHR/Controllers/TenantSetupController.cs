using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup")]
[Authorize]
[Obsolete("Draft/publish setup governance is retired by Change 1. Change 2 owns its replacement experience.")]
public sealed class TenantSetupController : ControllerBase
{
    [AcceptVerbs("GET", "POST", "PUT", "PATCH", "DELETE")]
    [Route("{**path}")]
    public IActionResult Retired() => StatusCode(StatusCodes.Status410Gone,
        ApiResponse.Failure("Legacy Organization setup governance is retired."));
}
