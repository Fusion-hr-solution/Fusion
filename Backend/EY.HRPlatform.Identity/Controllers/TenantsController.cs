using EY.HRPlatform.Identity.Features.Tenants.Dtos;
using EY.HRPlatform.Identity.Features.Tenants.Services;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/tenants")]
[Authorize(Roles = PlatformRole.PlatformAdmin)]
public class TenantsController : ControllerBase
{
    private readonly ITenantService _tenantService;

    public TenantsController(ITenantService tenantService)
    {
        _tenantService = tenantService;
    }

    /// <summary>
    /// Creates a new tenant.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<TenantDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<TenantDto>>> Create(
        [FromBody] CreateTenantRequest request,
        CancellationToken cancellationToken)
    {
        var tenant = await _tenantService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(
            nameof(GetById),
            new { id = tenant.Id },
            ApiResponse<TenantDto>.Success(tenant));
    }

    /// <summary>
    /// Gets all tenants. Use includeInactive=true to include deactivated tenants.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<TenantDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<TenantDto>>>> GetAll(
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        var tenants = await _tenantService.GetAllAsync(includeInactive, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<TenantDto>>.Success(tenants));
    }

    /// <summary>
    /// Gets a tenant by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TenantDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<TenantDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var tenant = await _tenantService.GetByIdAsync(id, cancellationToken);

        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Failure("Tenant not found."));

        return Ok(ApiResponse<TenantDto>.Success(tenant));
    }

    /// <summary>
    /// Updates a tenant's name.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TenantDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<TenantDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantDto>>> Update(
        Guid id,
        [FromBody] UpdateTenantRequest request,
        CancellationToken cancellationToken)
    {
        var tenant = await _tenantService.UpdateAsync(id, request, cancellationToken);

        if (tenant is null)
            return NotFound(ApiResponse<TenantDto>.Failure("Tenant not found."));

        return Ok(ApiResponse<TenantDto>.Success(tenant));
    }

    /// <summary>
    /// Deactivates a tenant (soft delete).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> Deactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var success = await _tenantService.DeactivateAsync(id, cancellationToken);

        if (!success)
            return NotFound(ApiResponse.Failure("Tenant not found."));

        return Ok(ApiResponse.Success());
    }

    /// <summary>
    /// Reactivates a previously deactivated tenant.
    /// </summary>
    [HttpPost("{id:guid}/reactivate")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> Reactivate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var success = await _tenantService.ReactivateAsync(id, cancellationToken);

        if (!success)
            return NotFound(ApiResponse.Failure("Tenant not found."));

        return Ok(ApiResponse.Success());
    }
}
