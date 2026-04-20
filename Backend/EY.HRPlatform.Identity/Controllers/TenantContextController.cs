using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Features.TenantContext.Dtos;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/tenant-context")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class TenantContextController(
    IPlatformOrganizationService platformOrganizations,
    ITenantContext tenantContext) : ControllerBase
{
    [HttpGet("organization-status")]
    [ProducesResponseType(typeof(ApiResponse<TenantOperationalStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<TenantOperationalStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantOperationalStatusDto>>> GetOrganizationStatus(
        CancellationToken cancellationToken)
    {
        var organization = await platformOrganizations.GetAsync(tenantContext.TenantId, cancellationToken);
        if (organization is null)
            return NotFound(ApiResponse<TenantOperationalStatusDto>.Failure("Organization not found."));

        var response = new TenantOperationalStatusDto(
            organization.Id,
            organization.OperationalStatus,
            organization.IsActive,
            organization.IsArchived);

        return Ok(ApiResponse<TenantOperationalStatusDto>.Success(response));
    }
}