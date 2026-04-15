using EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ActivateTenantSetup;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

[ApiController]
[Route("api/corehr/setup")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class TenantSetupController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var setupState = await sender.Send(new GetTenantSetupStateQuery(), cancellationToken);

        if (setupState.Version.HasValue)
            Response.Headers.ETag = $"\"{setupState.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(setupState));
    }

    [HttpPost("activate")]
    [ProducesResponseType(typeof(ApiResponse<TenantSetupStateDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Activate(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new ActivateTenantSetupCommand(), cancellationToken);

        if (result.Value.Version != 0)
            Response.Headers.ETag = $"\"{result.Value.Version}\"";

        return Ok(ApiResponse<TenantSetupStateDto>.Success(result.Value));
    }
}