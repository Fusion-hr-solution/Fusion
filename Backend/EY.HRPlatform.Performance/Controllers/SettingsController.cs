using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Authorize]
[Route("api/performance/settings")]
public sealed class SettingsController(IMediator mediator, IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<CycleSettingsDto>>> Get(CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new GetCycleSettingsQuery(), cancellationToken));
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<CycleSettingsDto>>> Update(
        [FromBody] UpdateCycleSettingsRequest request,
        CancellationToken cancellationToken)
    {
        if (!policy.CanAdministerCycles(User)) return Forbid();
        return MapResult(await mediator.Send(new UpdateCycleSettingsCommand(request), cancellationToken));
    }
}
