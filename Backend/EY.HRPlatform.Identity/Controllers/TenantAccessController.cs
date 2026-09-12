using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Controllers;

public sealed record InviteAdministratorRequest(string Email, string? FirstName, string? LastName);

public sealed record ReplaceInvitationEmailRequest(string Email);

public sealed record AdministratorActionRequest(string? Reason);

/// <summary>
/// The customer Access Management surface: who administers this tenant, who has
/// been invited to, and what has happened to that access.
/// <para>
/// Every refusal carries a stable problem type, so the workspace can distinguish
/// a duplicate invitation from an existing account from the final-administrator
/// rule from a stale screen — each of which the person resolves differently.
/// </para>
/// </summary>
[ApiController]
[Route("api/identity/tenant-access")]
[Authorize]
public sealed class TenantAccessController(
    ITenantAccessProjection projection,
    IAdministratorInvitationService invitations,
    ITenantAdministratorLifecycleService lifecycle,
    ITenantContext tenantContext) : ControllerBase
{
    // ── Reads ────────────────────────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetSummaryAsync(tenantId, cancellationToken))
            : refusal;

    [HttpGet("administrators")]
    public async Task<IActionResult> Administrators(CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetAdministratorsAsync(tenantId, cancellationToken))
            : refusal;

    [HttpGet("administrators/removed")]
    public async Task<IActionResult> RemovedAdministrators(CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetRemovedAdministratorsAsync(tenantId, cancellationToken))
            : refusal;

    [HttpGet("invitations")]
    public async Task<IActionResult> Invitations(
        [FromQuery] bool includeHistorical, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetInvitationsAsync(tenantId, includeHistorical, cancellationToken))
            : refusal;

    [HttpGet("activity")]
    public async Task<IActionResult> Activity(
        [FromQuery] DateTime? cursorOccurredAt,
        [FromQuery] Guid? cursorId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? category,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetActivityPageAsync(
                tenantId, cursorOccurredAt, cursorId, from, to, category,
                pageSize == 0 ? 25 : pageSize, cancellationToken))
            : refusal;

    [HttpGet("activity/recent")]
    public async Task<IActionResult> RecentActivity(CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: false, out var refusal)
            ? Success(await projection.GetRecentActivityAsync(tenantId, 5, cancellationToken))
            : refusal;

    // ── Invitations ──────────────────────────────────────

    [HttpPost("invitations")]
    public async Task<IActionResult> Invite(
        [FromBody] InviteAdministratorRequest request, CancellationToken cancellationToken)
    {
        if (!Resolve(out var tenantId, requireManage: true, out var refusal))
        {
            return refusal;
        }

        return Translate(await invitations.IssueAsync(
            tenantId, request.Email, User.GetUserId(),
            InvitationPurpose.TenantAdministrator,
            request.FirstName, request.LastName, cancellationToken));
    }

    [HttpPost("invitations/{invitationId:guid}/resend")]
    public async Task<IActionResult> Resend(Guid invitationId, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await invitations.ResendAsync(tenantId, invitationId, User.GetUserId(), cancellationToken))
            : refusal;

    [HttpPost("invitations/{invitationId:guid}/replace-email")]
    public async Task<IActionResult> ReplaceEmail(
        Guid invitationId, [FromBody] ReplaceInvitationEmailRequest request, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await invitations.ReplaceEmailAsync(
                tenantId, invitationId, request.Email, User.GetUserId(), cancellationToken))
            : refusal;

    [HttpPost("invitations/{invitationId:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid invitationId, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await invitations.RevokeAsync(tenantId, invitationId, User.GetUserId(), cancellationToken))
            : refusal;

    // ── Administrator lifecycle ──────────────────────────

    [HttpPost("administrators/{membershipId:guid}/suspend")]
    public async Task<IActionResult> Suspend(
        Guid membershipId, [FromBody] AdministratorActionRequest? request, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await lifecycle.SuspendAsync(
                Command(tenantId, membershipId, request?.Reason), cancellationToken))
            : refusal;

    [HttpPost("administrators/{membershipId:guid}/reactivate")]
    public async Task<IActionResult> Reactivate(
        Guid membershipId, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await lifecycle.ReactivateAsync(
                Command(tenantId, membershipId, null), cancellationToken))
            : refusal;

    [HttpPost("administrators/{membershipId:guid}/authority:grant")]
    public async Task<IActionResult> GrantAuthority(
        Guid membershipId, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await lifecycle.GrantAuthorityAsync(
                Command(tenantId, membershipId, null), cancellationToken))
            : refusal;

    /// <summary>Covers self-removal: the actor names their own membership.</summary>
    [HttpPost("administrators/{membershipId:guid}/authority:revoke")]
    public async Task<IActionResult> RevokeAuthority(
        Guid membershipId, [FromBody] AdministratorActionRequest? request, CancellationToken cancellationToken)
        => Resolve(out var tenantId, requireManage: true, out var refusal)
            ? Translate(await lifecycle.RevokeAuthorityAsync(
                Command(tenantId, membershipId, request?.Reason), cancellationToken))
            : refusal;

    // ── plumbing ─────────────────────────────────────────

    private AdministratorCommand Command(Guid tenantId, Guid membershipId, string? reason)
        => new(tenantId, membershipId, User.GetUserId(), ReadIfMatch(), reason);

    /// <summary>
    /// The version of the administrator's state the caller was looking at, echoed
    /// from the projection. Absent means the caller is making no claim about what
    /// they saw, so there is nothing to conflict with.
    /// </summary>
    private uint? ReadIfMatch()
    {
        var header = Request.Headers.IfMatch.FirstOrDefault()?.Trim('"');
        return uint.TryParse(header, out var version) ? version : null;
    }

    /// <summary>
    /// Resolves the tenant and the caller's authority together, because a request
    /// with no tenant context and a request from someone without permission are
    /// different refusals with different recoveries.
    /// </summary>
    private bool Resolve(out Guid tenantId, bool requireManage, out IActionResult refusal)
    {
        tenantId = Guid.Empty;
        refusal = Problem(
            type: "tenant-context-invalid",
            title: "A customer tenant context is required.",
            statusCode: StatusCodes.Status403Forbidden);

        var resolved = tenantContext.TenantIdOrDefault;

        if (resolved is null || resolved == Guid.Empty)
        {
            return false;
        }

        var permitted = requireManage
            ? User.HasCorePermission(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant)
            : User.HasCorePermission(CorePermissions.AccessAssignmentsView, PermissionScopes.Tenant)
              || User.HasCorePermission(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant);

        if (!permitted)
        {
            refusal = Problem(
                type: "permission-denied",
                title: "You do not have permission to manage Tenant Administrators.",
                statusCode: StatusCodes.Status403Forbidden);
            return false;
        }

        tenantId = resolved.Value;
        return true;
    }

    private IActionResult Translate(InvitationCommandResult result) => result.Outcome switch
    {
        InvitationCommandOutcome.Succeeded => Success(new
        {
            invitationId = result.InvitationId,
            // Not an error status: the invitation exists and can be resent, so
            // reporting a delivery problem as a failure would misstate what
            // happened.
            deliveryFailed = result.DeliveryFailed,
        }),
        InvitationCommandOutcome.InvalidEmail => Problem(
            "validation-failed", "Enter a valid email address.", StatusCodes.Status400BadRequest),
        InvitationCommandOutcome.ExistingAccount => Problem(
            "existing-account",
            "This email already belongs to a Fusion account and cannot be invited through this new-administrator flow.",
            StatusCodes.Status409Conflict),
        InvitationCommandOutcome.DuplicatePending => Problem(
            "duplicate-pending-invitation",
            "A pending invitation already exists for this email.",
            StatusCodes.Status409Conflict),
        InvitationCommandOutcome.NotFound => Problem(
            "not-found", "That invitation no longer exists.", StatusCodes.Status404NotFound),
        InvitationCommandOutcome.NotPending => Problem(
            "invitation-not-pending",
            "That invitation is no longer pending.",
            StatusCodes.Status409Conflict),
        InvitationCommandOutcome.RecoveryAlreadyPending => Problem(
            "recovery-already-pending",
            "A recovery invitation is already pending for this tenant.",
            StatusCodes.Status409Conflict),
        InvitationCommandOutcome.RecoveryNotEligible => Problem(
            "recovery-not-eligible",
            "This tenant still has a usable Tenant Administrator.",
            StatusCodes.Status409Conflict),
        _ => Problem("unexpected", "The request could not be completed.", StatusCodes.Status500InternalServerError),
    };

    private IActionResult Translate<T>(ContinuityResult<T> result) => result.Failure switch
    {
        ContinuityFailure.None => Success(result.Value),
        ContinuityFailure.FinalAdministrator => Problem(
            "final-administrator",
            TenantAccessProjection.FinalAdministratorReason,
            StatusCodes.Status409Conflict),
        // States the conflict only. Whether anything was reloaded is a fact about
        // the caller, not about this response, and asserting it here made the
        // message untrue for every client that did not refetch.
        ContinuityFailure.StaleState => Problem(
            "stale-state",
            "Administrator access changed while you were reviewing it.",
            StatusCodes.Status409Conflict),
        ContinuityFailure.NotFound => Problem(
            "not-found", "That administrator no longer exists.", StatusCodes.Status404NotFound),
        ContinuityFailure.NotApplicable => Problem(
            "not-applicable", result.Reason ?? "That action no longer applies.", StatusCodes.Status409Conflict),
        ContinuityFailure.NotAuthorized => Problem(
            "permission-denied", "You do not have permission to perform this action.",
            StatusCodes.Status403Forbidden),
        _ => Problem("unexpected", "The request could not be completed.", StatusCodes.Status500InternalServerError),
    };

    private IActionResult Problem(string type, string title, int statusCode)
        => StatusCode(
            statusCode,
            ApiResponse<object>.Failure(title, new { code = type }));

    private IActionResult Success<T>(T value)
        => Ok(ApiResponse<T>.Success(value));
}
