using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantAdministration;

public interface IAdministratorInvitationService
{
    Task<InvitationCommandResult> IssueAsync(
        Guid tenantId,
        string email,
        Guid actorUserId,
        InvitationPurpose purpose = InvitationPurpose.TenantAdministrator,
        CancellationToken cancellationToken = default);

    Task<InvitationCommandResult> ResendAsync(
        Guid tenantId, Guid invitationId, Guid actorUserId, CancellationToken cancellationToken = default);

    Task<InvitationCommandResult> ReplaceEmailAsync(
        Guid tenantId, Guid invitationId, string replacementEmail, Guid actorUserId,
        CancellationToken cancellationToken = default);

    Task<InvitationCommandResult> RevokeAsync(
        Guid tenantId, Guid invitationId, Guid actorUserId, CancellationToken cancellationToken = default);

    Task<AdministrativeInvitationEntry> InspectAsync(
        string credential, CancellationToken cancellationToken = default);
}

/// <summary>
/// The administrative and recovery invitation lifecycle.
/// <para>
/// Built on the bootstrap credential design — a non-secret selector for lookup
/// plus a one-way digest — rather than on the legacy workforce raw-token path. A
/// raw administrative secret never exists outside the delivery link and is never
/// returned in an API response.
/// </para>
/// </summary>
public sealed class AdministratorInvitationService(
    AppIdentityDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    IAdministrativeInvitationDelivery delivery) : IAdministratorInvitationService
{
    private const int ExpiryDays = 7;

    public async Task<InvitationCommandResult> IssueAsync(
        Guid tenantId,
        string email,
        Guid actorUserId,
        InvitationPurpose purpose = InvitationPurpose.TenantAdministrator,
        CancellationToken cancellationToken = default)
    {
        // Recovery is a Platform-initiated exception to customer control, and it is
        // only legitimate while the tenant has no usable administrator at all.
        // That predicate has to be evaluated under the tenant continuity lock
        // immediately before issuing, or a restoration committing at the same
        // moment would be raced. This method holds no such lock, so it refuses the
        // purpose outright rather than issuing a recovery nobody checked.
        if (purpose == InvitationPurpose.TenantAdministratorRecovery)
        {
            throw new InvalidOperationException(
                "Recovery invitations are issued only through the Platform recovery command, "
                + "which re-evaluates eligibility under the tenant continuity lock.");
        }

        if (!TryNormalizeEmail(email, out var normalized))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.InvalidEmail);
        }

        if (await AddressBelongsToAnAccountAsync(normalized, cancellationToken))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.ExistingAccount);
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        // The pending-uniqueness index cannot test expiry, because a partial index
        // predicate must be immutable. So an expired invitation still occupies the
        // slot for this address. Rather than refusing the administrator with a
        // duplicate they cannot see or resolve, inviting the address again
        // supersedes the expired predecessor in this same transaction.
        var occupant = await FindPendingByAddressAsync(tenantId, normalized, cancellationToken);

        if (occupant is not null && occupant.State == InvitationState.Pending)
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.DuplicatePending);
        }

        var invitation = InviteToken.CreateAdministrative(
            normalized, tenantId, actorUserId, purpose, ExpiryDays);

        var credential = BootstrapCredential.Issue();
        invitation.IssueCredential(credential.Selector, BootstrapCredential.Digest(credential.Secret));

        if (occupant is not null)
        {
            occupant.MarkSuperseded(invitation.Id);
            invitation.RecordPredecessor(occupant.Id);
        }

        dbContext.InviteTokens.Add(invitation);
        dbContext.AccessAuditEvents.Add(Audit(
            tenantId, actorUserId, AccessAuditActions.InvitationIssued, invitation.Id,
            $"Administrator invitation issued to {normalized}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        // Strictly after commit. A delivery problem must never unwind an
        // invitation that already exists and can simply be resent.
        var delivered = await DeliverAsync(invitation, credential, actorUserId, cancellationToken);
        return InvitationCommandResult.Ok(invitation.Id, deliveryFailed: !delivered);
    }

    public async Task<InvitationCommandResult> ResendAsync(
        Guid tenantId, Guid invitationId, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var invitation = await LockAndLoadAsync(tenantId, invitationId, cancellationToken);

        if (invitation is null)
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotFound);
        }

        if (invitation.State is not (InvitationState.Pending or InvitationState.Expired))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotPending);
        }

        // Rotating the selector is what makes the previously delivered link stop
        // resolving immediately. Extending expiry alone — the legacy workforce
        // behaviour — would leave the old link live, so a resend would widen
        // exposure instead of replacing it.
        var credential = BootstrapCredential.Issue();
        invitation.IssueCredential(credential.Selector, BootstrapCredential.Digest(credential.Secret));
        invitation.ExtendExpiry(ExpiryDays);

        dbContext.AccessAuditEvents.Add(Audit(
            tenantId, actorUserId, AccessAuditActions.InvitationResent, invitation.Id,
            $"Administrator invitation resent to {invitation.Email}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var delivered = await DeliverAsync(invitation, credential, actorUserId, cancellationToken);
        return InvitationCommandResult.Ok(invitation.Id, deliveryFailed: !delivered);
    }

    public async Task<InvitationCommandResult> ReplaceEmailAsync(
        Guid tenantId,
        Guid invitationId,
        string replacementEmail,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        if (!TryNormalizeEmail(replacementEmail, out var normalized))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.InvalidEmail);
        }

        if (await AddressBelongsToAnAccountAsync(normalized, cancellationToken))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.ExistingAccount);
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var predecessor = await LockAndLoadAsync(tenantId, invitationId, cancellationToken);

        if (predecessor is null)
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotFound);
        }

        if (predecessor.State is not (InvitationState.Pending or InvitationState.Expired))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotPending);
        }

        var competing = await FindPendingByAddressAsync(tenantId, normalized, cancellationToken);
        if (competing is not null && competing.Id != predecessor.Id && competing.State == InvitationState.Pending)
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.DuplicatePending);
        }

        var replacement = InviteToken.CreateAdministrative(
            normalized, tenantId, actorUserId, predecessor.Purpose, ExpiryDays);

        var credential = BootstrapCredential.Issue();
        replacement.IssueCredential(credential.Selector, BootstrapCredential.Digest(credential.Secret));

        // Lineage recorded both ways in one transaction. Superseded outranks
        // Revoked in the projected state, so a replaced predecessor can never
        // advertise a second successor.
        predecessor.MarkSuperseded(replacement.Id);
        replacement.RecordPredecessor(predecessor.Id);

        if (competing is not null && competing.Id != predecessor.Id)
        {
            competing.MarkSuperseded(replacement.Id);
        }

        dbContext.InviteTokens.Add(replacement);
        dbContext.AccessAuditEvents.Add(Audit(
            tenantId, actorUserId, AccessAuditActions.InvitationEmailReplaced, replacement.Id,
            $"Administrator invitation replaced; it is now addressed to {normalized}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        var delivered = await DeliverAsync(replacement, credential, actorUserId, cancellationToken);
        return InvitationCommandResult.Ok(replacement.Id, deliveryFailed: !delivered);
    }

    public async Task<InvitationCommandResult> RevokeAsync(
        Guid tenantId, Guid invitationId, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var invitation = await LockAndLoadAsync(tenantId, invitationId, cancellationToken);

        if (invitation is null)
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotFound);
        }

        if (invitation.State is not (InvitationState.Pending or InvitationState.Expired))
        {
            return InvitationCommandResult.Refused(InvitationCommandOutcome.NotPending);
        }

        // Terminal. There is no un-revoke; restoring the intent means issuing a
        // new invitation, which is a new decision with its own audit trail.
        invitation.Revoke();

        dbContext.AccessAuditEvents.Add(Audit(
            tenantId, actorUserId, AccessAuditActions.InvitationRevoked, invitation.Id,
            $"Administrator invitation to {invitation.Email} revoked."));

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return InvitationCommandResult.Ok(invitation.Id);
    }

    /// <summary>
    /// Read-only. Inspection never mutates, and never distinguishes an unknown
    /// selector from a wrong-purpose credential or a secret that does not verify,
    /// so a caller cannot probe for valid selectors.
    /// </summary>
    public async Task<AdministrativeInvitationEntry> InspectAsync(
        string credential, CancellationToken cancellationToken = default)
    {
        if (!BootstrapCredential.TryParse(credential, out var selector, out var secret))
        {
            return new AdministrativeInvitationEntry(AdministrativeInvitationEntryState.Invalid);
        }

        var invitation = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CredentialSelector == selector, cancellationToken);

        if (invitation is null
            || !InvitationPurposes.IsAdministrative(invitation.Purpose)
            || !invitation.MatchesCredentialDigest(BootstrapCredential.Digest(secret)))
        {
            return new AdministrativeInvitationEntry(AdministrativeInvitationEntryState.Invalid);
        }

        var terminal = invitation.State switch
        {
            InvitationState.Accepted => AdministrativeInvitationEntryState.AlreadyAccepted,
            InvitationState.Expired => AdministrativeInvitationEntryState.Expired,
            InvitationState.Revoked => AdministrativeInvitationEntryState.Revoked,
            InvitationState.Superseded => AdministrativeInvitationEntryState.Superseded,
            _ => (AdministrativeInvitationEntryState?)null,
        };

        if (terminal is not null)
        {
            return new AdministrativeInvitationEntry(terminal.Value, invitation.Purpose);
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == invitation.TenantId, cancellationToken);

        if (tenant is null || !tenant.IsActive || tenant.IsArchived)
        {
            return new AdministrativeInvitationEntry(
                AdministrativeInvitationEntryState.Revoked, invitation.Purpose);
        }

        // Surfaced before the form rather than after a filled-in submission: the
        // recipient cannot resolve this themselves, so asking them to choose a
        // password first would waste the only effort they can make.
        if (await AddressBelongsToAnAccountAsync(invitation.Email, cancellationToken))
        {
            return new AdministrativeInvitationEntry(
                AdministrativeInvitationEntryState.ExistingAccountConflict, invitation.Purpose);
        }

        return new AdministrativeInvitationEntry(
            AdministrativeInvitationEntryState.AccountCreation,
            invitation.Purpose,
            tenant.Name,
            invitation.Email,
            invitation.ExpiresAt);
    }

    // ── plumbing ─────────────────────────────────────────

    private async Task<bool> DeliverAsync(
        InviteToken invitation,
        BootstrapCredential credential,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        await delivery.DeliverAsync(
            invitation.Id, invitation.Email, credential, invitation.Purpose, actorUserId, cancellationToken);

        var outcome = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.Id == invitation.Id)
            .Select(item => item.DeliveryStatus)
            .FirstOrDefaultAsync(cancellationToken);

        return !string.Equals(outcome, "Failed", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Locks the invitation row for the whole transaction, so two administrators
    /// acting on the same invitation cannot both pass the state check.
    /// </summary>
    private async Task<InviteToken?> LockAndLoadAsync(
        Guid tenantId, Guid invitationId, CancellationToken cancellationToken)
    {
        if (dbContext.Database.IsRelational())
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM identity.\"InviteTokens\" WHERE \"Id\" = {0} FOR UPDATE",
                [invitationId], cancellationToken);
        }

        dbContext.ChangeTracker.Clear();

        return await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == invitationId
                && item.TenantId == tenantId
                && InvitationPurposes.Administrative.Contains(item.Purpose), cancellationToken);
    }

    private Task<InviteToken?> FindPendingByAddressAsync(
        Guid tenantId, string normalizedEmail, CancellationToken cancellationToken)
        => dbContext.InviteTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId
                && item.Email == normalizedEmail
                && InvitationPurposes.Administrative.Contains(item.Purpose)
                && item.AcceptedAt == null
                && !item.IsRevoked
                && item.SupersededAt == null, cancellationToken);

    /// <summary>
    /// New-account-only, checked with Identity's own normalizer so the comparison
    /// matches the unique index that ultimately enforces it.
    /// </summary>
    private async Task<bool> AddressBelongsToAnAccountAsync(string email, CancellationToken cancellationToken)
    {
        var normalized = userManager.NormalizeEmail(email);
        return await dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(user => user.NormalizedEmail == normalized, cancellationToken);
    }

    private static bool TryNormalizeEmail(string? email, out string normalized)
    {
        normalized = email?.Trim().ToLowerInvariant() ?? string.Empty;

        if (normalized.Length is 0 or > 256)
        {
            return false;
        }

        var at = normalized.IndexOf('@');
        return at > 0
            && at < normalized.Length - 1
            && normalized.IndexOf('.', at) > at + 1
            && !normalized.EndsWith('.')
            && !normalized.Contains(' ');
    }

    private static AccessAuditEvent Audit(
        Guid tenantId, Guid actorUserId, string action, Guid invitationId, string summary)
        => AccessAuditEvent.Create(
            tenantId,
            actorUserId,
            actorName: string.Empty,
            actorRole: TenantAdministratorAuthority.DisplayName,
            action: action,
            resourceType: AccessAuditActions.ResourceTypeInvitation,
            resourceId: invitationId.ToString(),
            summary: summary,
            beforeJson: null,
            afterJson: null,
            correlationId: null);
}
