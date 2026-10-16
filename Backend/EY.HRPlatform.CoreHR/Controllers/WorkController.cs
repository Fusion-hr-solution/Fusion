using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.Setup;
using EY.HRPlatform.CoreHR.Features.Work;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// The caller's Core HR work items. Each source is read only when the caller may view it, so someone
/// without setup or access permissions gets an empty list, never an error.
/// </summary>
[ApiController]
[Route("api/corehr/work")]
[Authorize]
public sealed class WorkController(
    ICoreHRReadinessService readiness,
    IWorkforceContractService workforce,
    ICoreAccessPolicyService accessPolicy) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<FusionWorkItemDto>>>> Get(CancellationToken cancellationToken)
    {
        if (User.GetTenantId() is not Guid tenantId)
            return Ok(ApiResponse<IReadOnlyList<FusionWorkItemDto>>.Success([]));
        var setup = accessPolicy.CanViewSetup(User) ? await readiness.GetAsync(cancellationToken) : null;
        var access = accessPolicy.CanViewAccess(User) ? await workforce.GetAccessRosterSummaryAsync(cancellationToken) : null;
        return Ok(ApiResponse<IReadOnlyList<FusionWorkItemDto>>.Success(CoreWorkItems.Compose(tenantId, setup, access)));
    }
}
