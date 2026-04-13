using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/platform-admin/organizations")]
[Authorize(Roles = PlatformRole.PlatformAdmin)]
public class PlatformOrganizationsController(IPlatformOrganizationService platformOrganizations) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationPagedListDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PlatformOrganizationPagedListDto>>> List(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        [FromQuery] string? search = null,
        [FromQuery] string orderBy = "createdAt",
        [FromQuery] string orderDirection = "desc",
        [FromQuery(Name = "filterByStatus")] string[]? filterByStatus = null,
        CancellationToken cancellationToken = default)
    {
        if (skip < 0)
            return BadRequest(ApiResponse<PlatformOrganizationPagedListDto>.Failure("skip must be >= 0."));

        if (take < 1)
            return BadRequest(ApiResponse<PlatformOrganizationPagedListDto>.Failure("take must be >= 1."));

        var query = new PlatformOrganizationListQueryDto
        {
            Skip = skip,
            Take = take,
            Search = search,
            OrderBy = orderBy,
            OrderDirection = orderDirection,
            FilterByStatus = filterByStatus,
        };

        var paged = await platformOrganizations.ListAsync(query, cancellationToken);
        return Ok(ApiResponse<PlatformOrganizationPagedListDto>.Success(paged));
    }

    [HttpGet("{tenantId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationDetailDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<PlatformOrganizationDetailDto>>> Get(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var org = await platformOrganizations.GetAsync(tenantId, cancellationToken);
        if (org is null)
            return NotFound(ApiResponse<PlatformOrganizationDetailDto>.Failure("Organization not found."));

        return Ok(ApiResponse<PlatformOrganizationDetailDto>.Success(org));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationCreatedDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<PlatformOrganizationCreatedDto>>> Create(
        [FromBody] CreatePlatformOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        Guid userId;
        try
        {
            userId = User.GetUserId();
        }
        catch (InvalidOperationException)
        {
            return BadRequest(ApiResponse<PlatformOrganizationCreatedDto>.Failure("Unable to determine current user."));
        }

        try
        {
            var created = await platformOrganizations.CreateAsync(request, userId, cancellationToken);
            return CreatedAtAction(nameof(Get), new { tenantId = created.Organization.Id },
                ApiResponse<PlatformOrganizationCreatedDto>.Success(created));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<PlatformOrganizationCreatedDto>.Failure(ex.Message));
        }
    }

    [HttpPatch("{tenantId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationDetailDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<PlatformOrganizationDetailDto>>> Update(
        Guid tenantId,
        [FromBody] UpdatePlatformOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await platformOrganizations.UpdateAsync(tenantId, request, cancellationToken);
            if (updated is null)
                return NotFound(ApiResponse<PlatformOrganizationDetailDto>.Failure("Organization not found."));

            return Ok(ApiResponse<PlatformOrganizationDetailDto>.Success(updated));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<PlatformOrganizationDetailDto>.Failure(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<PlatformOrganizationDetailDto>.Failure(ex.Message));
        }
    }

    [HttpPost("{tenantId:guid}/suspend")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<bool>>> Suspend(Guid tenantId, CancellationToken cancellationToken)
    {
        try
        {
            var ok = await platformOrganizations.SuspendAsync(tenantId, cancellationToken);
            if (!ok)
                return NotFound(ApiResponse<bool>.Failure("Organization not found."));

            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<bool>.Failure(ex.Message));
        }
    }

    [HttpPost("{tenantId:guid}/reactivate")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<bool>>> Reactivate(Guid tenantId, CancellationToken cancellationToken)
    {
        try
        {
            var ok = await platformOrganizations.ReactivateAsync(tenantId, cancellationToken);
            if (!ok)
                return NotFound(ApiResponse<bool>.Failure("Organization not found."));

            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<bool>.Failure(ex.Message));
        }
    }

    [HttpPost("{tenantId:guid}/archive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<bool>>> Archive(Guid tenantId, CancellationToken cancellationToken)
    {
        try
        {
            var ok = await platformOrganizations.ArchiveAsync(tenantId, cancellationToken);
            if (!ok)
                return NotFound(ApiResponse<bool>.Failure("Organization not found."));

            return Ok(ApiResponse<bool>.Success(true));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<bool>.Failure(ex.Message));
        }
    }

    [HttpPost("{tenantId:guid}/first-admin-invite/resend")]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationInviteStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<PlatformOrganizationInviteStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<PlatformOrganizationInviteStatusDto>>> ResendFirstAdminInvite(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        Guid userId;
        try
        {
            userId = User.GetUserId();
        }
        catch (InvalidOperationException)
        {
            return BadRequest(ApiResponse<PlatformOrganizationInviteStatusDto>.Failure("Unable to determine current user."));
        }

        var dto = await platformOrganizations.ResendFirstAdminInviteAsync(tenantId, userId, cancellationToken);
        if (dto is null)
            return NotFound(ApiResponse<PlatformOrganizationInviteStatusDto>.Failure(
                "No pending first-admin invitation found."));

        return Ok(ApiResponse<PlatformOrganizationInviteStatusDto>.Success(dto));
    }

    [HttpPost("{tenantId:guid}/first-admin-invite/revoke")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<bool>>> RevokeFirstAdminInvites(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var ok = await platformOrganizations.RevokePendingFirstAdminInvitesAsync(tenantId, cancellationToken);
        if (!ok)
            return NotFound(ApiResponse<bool>.Failure("No pending first-admin invitations to revoke."));

        return Ok(ApiResponse<bool>.Success(true));
    }
}
