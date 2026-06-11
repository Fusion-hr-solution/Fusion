using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Features.TenantContext.Dtos;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/tenant-context")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class TenantContextController(
    IPlatformOrganizationService platformOrganizations,
    ITenantContext tenantContext,
    AppIdentityDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Resolve a tenant slug to its full summary. Used by frontend when navigating via slug in URL.
    /// </summary>
    [HttpGet("by-slug/{slug}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<TenantSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<TenantSummaryDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantSummaryDto>>> GetBySlug(
        string slug,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == slug.ToLowerInvariant(), cancellationToken);

        if (tenant is null)
            return NotFound(ApiResponse<TenantSummaryDto>.Failure("Tenant not found."));

        var organization = await platformOrganizations.GetAsync(tenant.Id, cancellationToken);
        if (organization is null)
            return NotFound(ApiResponse.Failure("Tenant not found."));

        var dto = new TenantSummaryDto(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            organization.OperationalStatus,
            tenant.IsActive,
            tenant.IsArchived);

        return Ok(ApiResponse<TenantSummaryDto>.Success(dto));
    }

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

    /// <summary>
    /// Lightweight tenant summary for the tenant-context banner — returns name and status.
    /// Available to any authorized user with a resolved tenant context.
    /// </summary>
    [HttpGet("tenant-summary")]
    [ProducesResponseType(typeof(ApiResponse<TenantSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantSummaryDto>>> GetTenantSummary(
        CancellationToken cancellationToken)
    {
        var organization = await platformOrganizations.GetAsync(tenantContext.TenantId, cancellationToken);
        if (organization is null)
            return NotFound(ApiResponse.Failure("Tenant not found."));

        var dto = new TenantSummaryDto(
            organization.Id,
            organization.Name,
            organization.Slug,
            organization.OperationalStatus,
            organization.IsActive,
            organization.IsArchived);

        return Ok(ApiResponse<TenantSummaryDto>.Success(dto));
    }
}