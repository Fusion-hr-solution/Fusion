using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>
/// Platform control-plane tenant administration.
///
/// Every endpoint requires the Platform Administrator role and none of them
/// grants customer-workspace entry: there is deliberately no impersonation,
/// support-session, or tenant-context switch here.
/// </summary>
[ApiController]
[Route("api/identity/platform-admin/tenants")]
[Authorize(Roles = PlatformRole.PlatformAdmin)]
public sealed class PlatformTenantsController(
    ITenantProvisioningService provisioning,
    IBootstrapInvitationRecoveryService recovery,
    ITenantLifecycleService lifecycle,
    ITenantProfileService profile,
    ITenantDetailProjection tenantDetail,
    ITenantOverviewProjection tenantOverview,
    ITenantActivityProjection tenantActivity) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ProvisionTenantResult>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<ProvisionTenantResult>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<ProvisionTenantResult>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<ProvisionTenantResult>>> Provision(
        [FromBody] ProvisionTenantRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await provisioning.ProvisionAsync(request, User.GetUserId(), cancellationToken);

        if (result.IsFailure)
        {
            // A conflict is a different outcome from invalid input: the caller can
            // resolve one by changing the request and the other only by using a
            // new key, so they must not collapse into one status.
            // The code travels with the message so the workspace can put a
            // validation failure on the field that caused it instead of matching
            // message text.
            var failure = ApiResponse<ProvisionTenantResult>.Failure(
                result.Error.Message, new FailureCode(result.Error.Code));

            return result.Error.Code switch
            {
                "provisioning.idempotency_conflict" or "provisioning.duplicate_name" =>
                    Conflict(failure),
                _ => BadRequest(failure),
            };
        }

        return CreatedAtAction(
            nameof(GetDetail),
            new { tenantId = result.Value.TenantId },
            ApiResponse<ProvisionTenantResult>.Success(result.Value));
    }

    /// <summary>
    /// The operational tenant list backing the Tenants workspace.
    ///
    /// Filtering, sorting, counting and paging all happen here so the workspace
    /// can never report a total derived from the rows it happens to be showing.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<TenantOverviewPageDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<TenantOverviewPageDto>>> List(
        [FromQuery] TenantOverviewFilter filter = TenantOverviewFilter.All,
        [FromQuery] string? search = null,
        [FromQuery] InvitationState[]? invitationState = null,
        [FromQuery] InvitationDeliveryOutcome[]? delivery = null,
        [FromQuery] TenantModule[]? module = null,
        [FromQuery] DateOnly? createdFrom = null,
        [FromQuery] DateOnly? createdTo = null,
        [FromQuery] TenantOverviewSort sort = TenantOverviewSort.CreatedDescending,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await tenantOverview.GetAsync(
            new TenantOverviewQuery
            {
                Filter = filter,
                Search = search,
                InvitationStates = invitationState ?? [],
                DeliveryOutcomes = delivery ?? [],
                Modules = module ?? [],
                CreatedFrom = createdFrom,
                CreatedTo = createdTo,
                Sort = sort,
                Page = page,
                PageSize = pageSize,
            },
            cancellationToken);

        return Ok(ApiResponse<TenantOverviewPageDto>.Success(result));
    }

    /// <summary>
    /// The modules provisioning will accept, and which of them are granted
    /// regardless of the request. The workspace derives module availability from
    /// this rather than restating the rule in its own text.
    /// </summary>
    [HttpGet("module-catalogue")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ProvisionableModuleDto>>), StatusCodes.Status200OK)]
    public ActionResult<ApiResponse<IReadOnlyList<ProvisionableModuleDto>>> ModuleCatalogue()
        => Ok(ApiResponse<IReadOnlyList<ProvisionableModuleDto>>.Success(
            ProvisionableModuleCatalogue.All));

    /// <summary>
    /// Recent bootstrap activity across every customer tenant.
    ///
    /// Deliberately shaped as the durable read a full audit page would also use,
    /// rather than one tailored to the preview that consumes it today.
    /// </summary>
    [HttpGet("activity")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<TenantActivityEntryDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<TenantActivityEntryDto>>>> Activity(
        [FromQuery] int limit = TenantActivityProjection.DefaultLimit,
        CancellationToken cancellationToken = default)
    {
        var entries = await tenantActivity.GetRecentAsync(limit, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<TenantActivityEntryDto>>.Success(entries));
    }

    [HttpGet("{tenantId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<TenantDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<TenantDetailDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> GetDetail(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var detail = await tenantDetail.GetAsync(tenantId, cancellationToken);
        return detail is null
            ? NotFound(ApiResponse<TenantDetailDto>.Failure("Tenant not found."))
            : Ok(ApiResponse<TenantDetailDto>.Success(detail));
    }

    /// <summary>
    /// Tenant lifecycle: deactivate (remove customer access) or reactivate.
    /// Both preserve tenant data; deactivation is reversible.
    /// </summary>
    [HttpPost("{tenantId:guid}/deactivate")]
    public Task<ActionResult<ApiResponse<object?>>> Deactivate(Guid tenantId, CancellationToken ct = default)
        => RunLifecycleAsync(() => lifecycle.DeactivateAsync(tenantId, User.GetUserId(), ct));

    [HttpPost("{tenantId:guid}/reactivate")]
    public Task<ActionResult<ApiResponse<object?>>> Reactivate(Guid tenantId, CancellationToken ct = default)
        => RunLifecycleAsync(() => lifecycle.ReactivateAsync(tenantId, User.GetUserId(), ct));

    /// <summary>
    /// Renames the tenant's organization display name. The tenant key and other
    /// immutable provisioning facts are unaffected.
    /// </summary>
    [HttpPost("{tenantId:guid}/rename")]
    public async Task<ActionResult<ApiResponse<object?>>> Rename(
        Guid tenantId,
        [FromBody] RenameTenantRequest request,
        CancellationToken ct = default)
    {
        var result = await profile.RenameAsync(tenantId, request.Name, User.GetUserId(), ct);

        if (result.IsSuccess)
        {
            return new OkObjectResult(ApiResponse<object?>.Success(null));
        }

        var failure = ApiResponse<object?>.Failure(
            result.Error.Message, new FailureCode(result.Error.Code));

        return result.Error.Code switch
        {
            "tenant.not_found" => new NotFoundObjectResult(failure),
            "tenant.invalid_name" => new BadRequestObjectResult(failure),
            _ => new BadRequestObjectResult(failure),
        };
    }

    private static async Task<ActionResult<ApiResponse<object?>>> RunLifecycleAsync(
        Func<Task<SharedKernel.Results.Result>> action)
    {
        var result = await action();

        if (result.IsSuccess)
        {
            return new OkObjectResult(ApiResponse<object?>.Success(null));
        }

        var failure = ApiResponse<object?>.Failure(
            result.Error.Message, new FailureCode(result.Error.Code));

        return result.Error.Code switch
        {
            "tenant.not_found" => new NotFoundObjectResult(failure),
            // Already in the requested state: the caller refreshes to the truth.
            "tenant.invalid_lifecycle_state" => new ConflictObjectResult(failure),
            _ => new BadRequestObjectResult(failure),
        };
    }

    [HttpPost("{tenantId:guid}/bootstrap-invitation/{invitationId:guid}/resend")]
    public Task<ActionResult<ApiResponse<Guid>>> Resend(Guid tenantId, Guid invitationId, CancellationToken ct = default)
        => RunRecoveryAsync(() => recovery.ResendAsync(tenantId, invitationId, User.GetUserId(), ct));

    [HttpPost("{tenantId:guid}/bootstrap-invitation/{invitationId:guid}/revoke")]
    public Task<ActionResult<ApiResponse<Guid>>> Revoke(Guid tenantId, Guid invitationId, CancellationToken ct = default)
        => RunRecoveryAsync(() => recovery.RevokeAsync(tenantId, invitationId, User.GetUserId(), ct));

    [HttpPost("{tenantId:guid}/bootstrap-invitation/{invitationId:guid}/replace")]
    public Task<ActionResult<ApiResponse<Guid>>> Replace(
        Guid tenantId,
        Guid invitationId,
        [FromBody] ReplaceAdministratorRequest request,
        CancellationToken ct = default)
        => RunRecoveryAsync(() => recovery.ReplaceAsync(tenantId, invitationId, request.Email, User.GetUserId(), ct));

    [HttpPost("{tenantId:guid}/bootstrap-invitation/{invitationId:guid}/reissue")]
    public Task<ActionResult<ApiResponse<Guid>>> Reissue(Guid tenantId, Guid invitationId, CancellationToken ct = default)
        => RunRecoveryAsync(() => recovery.ReissueAsync(tenantId, invitationId, User.GetUserId(), ct));

    private static async Task<ActionResult<ApiResponse<Guid>>> RunRecoveryAsync(
        Func<Task<SharedKernel.Results.Result<Guid>>> action)
    {
        var result = await action();

        if (result.IsSuccess)
        {
            return new OkObjectResult(ApiResponse<Guid>.Success(result.Value));
        }

        var failure = ApiResponse<Guid>.Failure(
            result.Error.Message, new FailureCode(result.Error.Code));

        // A stale command reports conflict and the caller refreshes to the
        // authoritative state; a missing invitation is simply not found.
        return result.Error.Code switch
        {
            "bootstrap.invitation_not_found" => new NotFoundObjectResult(failure),
            "bootstrap.invalid_state" => new ConflictObjectResult(failure),
            _ => new BadRequestObjectResult(failure),
        };
    }
}

public sealed record ReplaceAdministratorRequest
{
    public string Email { get; init; } = string.Empty;
}

public sealed record RenameTenantRequest
{
    public string Name { get; init; } = string.Empty;
}

/// <summary>
/// Structured failure detail carried alongside the message, so a caller can
/// branch on a stable code rather than parse prose.
/// </summary>
public sealed record FailureCode(string Code);
