using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The caller's Performance capabilities, for permission-aware "hide, don't deny" rendering.
/// Server authorization is still enforced on every action regardless of this read.
/// </summary>
[ApiController]
[Authorize]
[Route("api/performance/access")]
public sealed class AccessController(IPerformanceAccessPolicyService policy) : PerformanceControllerBase
{
    [HttpGet]
    public ActionResult<ApiResponse<PerformanceAccessDto>> GetAccess()
    {
        var dto = new PerformanceAccessDto(
            policy.CanEnterPerformance(User),
            policy.CanAdministerCycles(User),
            policy.CanPublishStrategy(User),
            policy.CanManageOwnParticipation(User),
            policy.AggregateViewScope(User));

        return Ok(ApiResponse<PerformanceAccessDto>.Success(dto));
    }
}
