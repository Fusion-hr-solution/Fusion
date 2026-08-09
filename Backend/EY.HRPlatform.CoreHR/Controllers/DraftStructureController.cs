using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup/draft-structure")]
[Authorize]
[Obsolete("Draft Structure is retired by Change 1. Change 2 removes this endpoint.")]
public sealed class DraftStructureController : ControllerBase
{
    [AcceptVerbs("GET", "POST", "PUT", "PATCH", "DELETE")]
    [Route("{**path}")]
    public IActionResult Retired() => StatusCode(StatusCodes.Status410Gone,
        ApiResponse.Failure("Draft Structure is retired. Use the canonical Organization capability."));
}
