using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiResponse = EY.HRPlatform.SharedKernel.Api.ApiResponse;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/core-access")]
[Authorize]
public sealed class CoreAccessController(
    IAccessProfileService accessProfileService,
    ITenantContext tenantContext) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<CurrentUserAccessDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<CurrentUserAccessDto>>> GetCurrentUserAccess(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<CurrentUserAccessDto>.Failure("Tenant context is required."));
        }

        var user = new Domain.Entities.ApplicationUser
        {
            Id = userId,
            TenantId = tenantId.Value,
            Email = User.GetEmail(),
            FirstName = User.GetFullName(),
            LastName = string.Empty,
            EmployeeId = User.GetEmployeeId(),
        };

        var response = await accessProfileService.GetCurrentUserAccessAsync(user, cancellationToken);
        return Ok(ApiResponse<CurrentUserAccessDto>.Success(response));
    }

    [HttpGet("catalog")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CorePermissionCatalogItemDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CorePermissionCatalogItemDto>>>> GetCatalog(CancellationToken cancellationToken)
    {
        if (!CanManageAccessProfiles())
        {
            return Forbid();
        }

        var response = await accessProfileService.GetPermissionCatalogAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CorePermissionCatalogItemDto>>.Success(response));
    }

    [HttpGet("profiles")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AccessProfileSummaryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AccessProfileSummaryDto>>>> GetProfiles(CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<IReadOnlyList<AccessProfileSummaryDto>>.Failure("Tenant context is required."));
        }

        if (!CanReadAccessProfiles())
        {
            return Forbid();
        }

        var response = await accessProfileService.GetProfilesAsync(tenantId.Value, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<AccessProfileSummaryDto>>.Success(response));
    }

    [HttpGet("profiles/{profileId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AccessProfileSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<AccessProfileSummaryDto>>> GetProfile(Guid profileId, CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<AccessProfileSummaryDto>.Failure("Tenant context is required."));
        }

        if (!CanReadAccessProfiles())
        {
            return Forbid();
        }

        var response = await accessProfileService.GetProfileAsync(tenantId.Value, profileId, cancellationToken);
        return response is null
            ? NotFound(ApiResponse<AccessProfileSummaryDto>.Failure("Access profile not found."))
            : Ok(ApiResponse<AccessProfileSummaryDto>.Success(response));
    }

    [HttpPost("profiles")]
    [ProducesResponseType(typeof(ApiResponse<AccessProfileSummaryDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<AccessProfileSummaryDto>>> CreateProfile(
        [FromBody] CreateAccessProfileRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<AccessProfileSummaryDto>.Failure("Tenant context is required."));
        }

        if (!CanManageAccessProfiles())
        {
            return Forbid();
        }

        try
        {
            var response = await accessProfileService.CreateProfileAsync(tenantId.Value, request, cancellationToken);
            return CreatedAtAction(nameof(GetProfile), new { profileId = response.Id }, ApiResponse<AccessProfileSummaryDto>.Success(response));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<AccessProfileSummaryDto>.Failure(exception.Message));
        }
    }

    [HttpPut("profiles/{profileId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AccessProfileSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<AccessProfileSummaryDto>>> UpdateProfile(
        Guid profileId,
        [FromBody] UpdateAccessProfileRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<AccessProfileSummaryDto>.Failure("Tenant context is required."));
        }

        if (!CanManageAccessProfiles())
        {
            return Forbid();
        }

        if (!TryParseVersion(ifMatch, out var version))
        {
            return Conflict(ApiResponse<AccessProfileSummaryDto>.Failure("If-Match header with a valid version is required."));
        }

        try
        {
            var response = await accessProfileService.UpdateProfileAsync(tenantId.Value, profileId, version, request, cancellationToken);
            Response.Headers.ETag = $"\"{response.Version}\"";
            return Ok(ApiResponse<AccessProfileSummaryDto>.Success(response));
        }
        catch (DbUpdateConcurrencyException exception)
        {
            return Conflict(ApiResponse<AccessProfileSummaryDto>.Failure(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<AccessProfileSummaryDto>.Failure(exception.Message));
        }
    }

    [HttpDelete("profiles/{profileId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteProfile(Guid profileId, CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse.Failure("Tenant context is required."));
        }

        if (!CanManageAccessProfiles())
        {
            return Forbid();
        }

        try
        {
            await accessProfileService.DeleteProfileAsync(tenantId.Value, profileId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse.Failure(exception.Message));
        }
    }

    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<UserAccessAssignmentDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UserAccessAssignmentDto>>>> GetAssignments(CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<IReadOnlyList<UserAccessAssignmentDto>>.Failure("Tenant context is required."));
        }

        if (!CanManageAccessProfiles())
        {
            return Forbid();
        }

        var response = await accessProfileService.GetUserAssignmentsAsync(tenantId.Value, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<UserAccessAssignmentDto>>.Success(response));
    }

    [HttpPut("assignments/{userId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UserAccessAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<UserAccessAssignmentDto>>> SetAssignments(
        Guid userId,
        [FromBody] SetUserAccessProfilesRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<UserAccessAssignmentDto>.Failure("Tenant context is required."));
        }

        if (!CanManageAccess() && !CanManageAccessProfiles())
        {
            return Forbid();
        }

        try
        {
            var response = await accessProfileService.SetUserAccessProfilesAsync(
                tenantId.Value,
                userId,
                request.AccessProfileIds,
                cancellationToken);

            return Ok(ApiResponse<UserAccessAssignmentDto>.Success(response));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<UserAccessAssignmentDto>.Failure(exception.Message));
        }
    }

    private Guid? ResolveTenantId()
        => tenantContext.TenantIdOrDefault;

    private bool CanReadAccessProfiles()
        => CanManageAccessProfiles()
            || User.HasCorePermission(CorePermissions.AccessView, PermissionScopes.Tenant)
            || User.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant);

    private bool CanManageAccess()
        => User.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant);

    private bool CanManageAccessProfiles()
        => User.HasCorePermission(CorePermissions.AccessProfilesManage, PermissionScopes.Tenant);

    private static bool TryParseVersion(string? ifMatch, out uint version)
    {
        version = 0;
        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return false;
        }

        return uint.TryParse(ifMatch.Trim().Trim('"'), out version);
    }
}
