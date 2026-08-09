using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// Retained only to make the retired endpoint fail explicitly while clients move to
/// the canonical Organization capability. Change 2 removes this controller.
/// </summary>
[ApiController]
[Route("api/corehr/org-units")]
[Authorize]
[Obsolete("Use /api/corehr/organization. Change 2 removes this retired endpoint.")]
public sealed class OrgUnitsController : ControllerBase
{
    [AcceptVerbs("GET", "POST", "PUT", "PATCH", "DELETE")]
    [Route("{**path}")]
    public IActionResult Retired()
        => StatusCode(StatusCodes.Status410Gone, ApiResponse.Failure(
            "This legacy Organization endpoint is retired. Use the canonical Organization API."));
}
