using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Queries.GetTenantSettings;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/settings")]
[Authorize(Roles = $"{PlatformRole.Admin},{PlatformRole.HR}")]
public class TenantSettingsController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Get tenant settings for the current tenant.
    /// Returns merged platform defaults with tenant-specific overrides.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var settings = await sender.Send(new GetTenantSettingsQuery(), cancellationToken);
        return Ok(ApiResponse<TenantSettingsDto>.Success(settings));
    }
}
