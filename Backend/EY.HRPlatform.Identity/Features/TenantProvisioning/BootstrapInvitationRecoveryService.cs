using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface IBootstrapInvitationRecoveryService
{
    Task<Result<Guid>> ResendAsync(Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default);
    Task<Result<Guid>> RevokeAsync(Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default);
    Task<Result<Guid>> ReplaceAsync(Guid tenantId, Guid invitationId, string replacementEmail, Guid actorAccountId, CancellationToken ct = default);
    Task<Result<Guid>> ReissueAsync(Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default);
}

/// <summary>
/// The exact recovery transitions. Preconditions are checked against the stored
/// state, so a command built from a stale view returns a conflict rather than
/// acting on an invitation that has since moved on.
///
/// Every mutation commits before delivery is requested, so a failed send never
/// rolls back a state change the operator can see.
/// </summary>
public sealed class BootstrapInvitationRecoveryService(
    AppIdentityDbContext dbContext,
    IBootstrapInvitationDelivery delivery) : IBootstrapInvitationRecoveryService
{
    private const int ReissueExpiryDays = 7;

    public async Task<Result<Guid>> ResendAsync(
        Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        var load = await LoadAsync(tenantId, invitationId, ct);
        if (load.IsFailure) return Result.Failure<Guid>(load.Error);
        var invitation = load.Value;

        if (invitation.State != InvitationState.Pending)
            return Conflict(invitation, "resend");

        // The raw secret was never stored, so resending necessarily issues a new
        // credential. The previous link stops working — that is the honest
        // consequence of hash-only storage, not an incidental side effect.
        var credential = BootstrapCredential.Issue();
        invitation.IssueCredential(
            credential.Selector, BootstrapCredential.Digest(credential.Secret));

        Audit(TenantBootstrapAuditEventType.InvitationResent, invitation, actorAccountId);
        var saved = await SaveTransitionAsync(invitation, invitation.Id, ct);
        if (saved.IsFailure) return saved;

        await delivery.DeliverAsync(invitation.Id, invitation.Email, credential, actorAccountId, CancellationToken.None);
        return saved;
    }

    public async Task<Result<Guid>> RevokeAsync(
        Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        var load = await LoadAsync(tenantId, invitationId, ct);
        if (load.IsFailure) return Result.Failure<Guid>(load.Error);
        var invitation = load.Value;

        if (invitation.State != InvitationState.Pending)
            return Conflict(invitation, "revoke");

        invitation.Revoke();
        Audit(TenantBootstrapAuditEventType.InvitationRevoked, invitation, actorAccountId);
        return await SaveTransitionAsync(invitation, invitation.Id, ct);
    }

    public async Task<Result<Guid>> ReplaceAsync(
        Guid tenantId, Guid invitationId, string replacementEmail, Guid actorAccountId, CancellationToken ct = default)
    {
        var email = replacementEmail?.Trim() ?? string.Empty;
        if (email.Length == 0 || !email.Contains('@') || !email.Contains('.'))
            return Result.Failure<Guid>(new Error(
                "bootstrap.replacement_email_invalid", "A valid replacement administrator email is required."));

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        var load = await LoadAsync(tenantId, invitationId, ct);
        if (load.IsFailure) return Result.Failure<Guid>(load.Error);
        var invitation = load.Value;

        // Replacing the invited email is also how an expired or revoked tenant is
        // handed to a different administrator, so it is not confined to a live
        // invitation. Only an accepted or already-replaced one offers nothing.
        if (invitation.State is not (InvitationState.Pending
            or InvitationState.Expired or InvitationState.Revoked))
            return Conflict(invitation, "replace");

        var credential = BootstrapCredential.Issue();
        var replacement = InviteToken.CreateOrganizationBootstrap(
            email, tenantId, actorAccountId, ReissueExpiryDays);
        replacement.IssueCredential(
            credential.Selector, BootstrapCredential.Digest(credential.Secret));
        replacement.RecordPredecessor(invitation.Id);

        VacateLiveSlot(invitation, replacement.Id);
        dbContext.InviteTokens.Add(replacement);

        Audit(TenantBootstrapAuditEventType.InvitationReplaced, invitation, actorAccountId);
        var replaced = await SaveTransitionAsync(invitation, replacement.Id, ct);
        if (replaced.IsFailure) return replaced;

        await delivery.DeliverAsync(replacement.Id, email, credential, actorAccountId, CancellationToken.None);
        return replaced;
    }

    public async Task<Result<Guid>> ReissueAsync(
        Guid tenantId, Guid invitationId, Guid actorAccountId, CancellationToken ct = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        var load = await LoadAsync(tenantId, invitationId, ct);
        if (load.IsFailure) return Result.Failure<Guid>(load.Error);
        var invitation = load.Value;

        // Reissue exists for invitations that can no longer be used but were
        // never accepted.
        if (invitation.State is not (InvitationState.Expired or InvitationState.Revoked))
            return Conflict(invitation, "reissue");

        var credential = BootstrapCredential.Issue();
        var replacement = InviteToken.CreateOrganizationBootstrap(
            invitation.Email, tenantId, actorAccountId, ReissueExpiryDays);
        replacement.IssueCredential(
            credential.Selector, BootstrapCredential.Digest(credential.Secret));
        replacement.RecordPredecessor(invitation.Id);

        VacateLiveSlot(invitation, replacement.Id);
        dbContext.InviteTokens.Add(replacement);
        Audit(TenantBootstrapAuditEventType.InvitationReissued, invitation, actorAccountId);
        var reissued = await SaveTransitionAsync(invitation, replacement.Id, ct);
        if (reissued.IsFailure) return reissued;

        await delivery.DeliverAsync(replacement.Id, invitation.Email, credential, actorAccountId, CancellationToken.None);
        return reissued;
    }

    /// <summary>
    /// Commits a recovery transition. A concurrent command that already moved the
    /// invitation makes this write lose the optimistic-concurrency check, which
    /// is reported as the same stale conflict a caller would get from acting on a
    /// state they could see was wrong.
    /// </summary>
    private async Task<Result<Guid>> SaveTransitionAsync(
        InviteToken invitation, Guid successId, CancellationToken ct)
    {
        try
        {
            await dbContext.SaveChangesAsync(ct);
            if (dbContext.Database.CurrentTransaction is { } active)
            {
                await active.CommitAsync(ct);
            }

            return Result.Success<Guid>(successId);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            // The one-live-bootstrap-invitation index rejected a racing writer.
            // Report the same stale conflict the caller would get from acting on
            // a state they could see had moved on.
            dbContext.ChangeTracker.Clear();
            return Result.Failure<Guid>(StaleConflict);
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.ChangeTracker.Clear();
            return Result.Failure<Guid>(StaleConflict);
        }
    }

    private async Task<Result<InviteToken>> LoadAsync(
        Guid tenantId, Guid invitationId, CancellationToken ct)
    {
        // Tenant is part of the lookup, so an identifier from another tenant is
        // simply not found rather than acted upon.
        // Serialize concurrent transitions on this invitation. Without the lock,
        // two resends could both read Pending and each rotate the credential,
        // leaving one administrator with a link that never worked.
        if (dbContext.Database.IsRelational())
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM identity.\"InviteTokens\" WHERE \"Id\" = {0} FOR UPDATE",
                [invitationId], ct);
        }

        var invitation = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                item => item.Id == invitationId
                    && item.TenantId == tenantId
                    && item.Purpose == InvitationPurpose.OrganizationBootstrap,
                ct);

        return invitation is null
            ? Result.Failure<InviteToken>(new Error(
                "bootstrap.invitation_not_found", "Bootstrap invitation not found."))
            : Result.Success<InviteToken>(invitation);
    }

    /// <summary>
    /// Retires the predecessor so exactly one bootstrap invitation is live.
    ///
    /// An Expired invitation still occupies the filtered unique index, because a
    /// partial predicate must be immutable and so cannot test a moving expiry. A
    /// Revoked one has left the index but must still be retired: a predecessor
    /// that stayed merely Revoked would keep advertising recovery and could fork
    /// a second successor. What happened to it is preserved as audit history,
    /// which is where the tenant's record reads its past from.
    /// </summary>
    private static void VacateLiveSlot(InviteToken invitation, Guid replacementId)
    {
        if (!invitation.IsSuperseded && !invitation.IsUsed)
        {
            invitation.MarkSuperseded(replacementId);
        }
    }

    private static Error StaleConflict => new(
        "bootstrap.invalid_state",
        "This invitation changed while the command was in flight. Refresh and try again.");

    private static bool IsUniqueViolation(DbUpdateException exception)
        => exception.InnerException is Npgsql.PostgresException { SqlState: "23505" };

    private static Result<Guid> Conflict(InviteToken invitation, string action)
        => Result.Failure<Guid>(new Error(
            "bootstrap.invalid_state",
            $"Cannot {action} an invitation that is {invitation.State}.",
            new { currentState = invitation.State.ToString() }));

    private void Audit(TenantBootstrapAuditEventType eventType, InviteToken invitation, Guid actorAccountId)
        => dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            eventType,
            invitation.TenantId,
            correlationId: Guid.NewGuid(),
            outcome: "Succeeded",
            invitationId: invitation.Id,
            actorAccountId: actorAccountId));
}
