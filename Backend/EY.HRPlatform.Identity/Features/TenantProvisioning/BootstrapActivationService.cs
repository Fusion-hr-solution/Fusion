using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// What a submitted credential means, without disclosing anything about the
/// tenant or account behind it.
/// </summary>
public enum BootstrapActivationOutcome
{
    /// <summary>Activation completed and the tenant is now Active.</summary>
    Activated = 0,

    /// <summary>
    /// Already accepted. Deliberately terminal-but-neutral: a replayed link must
    /// not reveal whether it was this recipient who accepted it.
    /// </summary>
    AlreadyAccepted = 1,

    /// <summary>Invalid, expired, revoked, superseded, wrong-purpose, or mismatched.</summary>
    NotActivatable = 2,

    /// <summary>The matching account cannot receive this membership.</summary>
    AccountIneligible = 3,
}

public sealed record BootstrapActivationRequest
{
    /// <summary>The raw selector.secret from the delivery link.</summary>
    public string Credential { get; init; } = string.Empty;

    /// <summary>Proven email control. Must equal the invited address.</summary>
    public string Email { get; init; } = string.Empty;

    /// <summary>Supplied only when creating a new account.</summary>
    public string? Password { get; init; }

    public string? FirstName { get; init; }
    public string? LastName { get; init; }
}

public sealed record BootstrapActivationResult(
    BootstrapActivationOutcome Outcome,
    Guid? TenantId = null,
    Guid? AccountId = null);

public interface IBootstrapActivationService
{
    Task<BootstrapActivationResult> ActivateAsync(
        BootstrapActivationRequest request,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Turns a valid bootstrap credential into durable tenant access, in one
/// transaction.
///
/// Failure responses are deliberately coarse. A caller holding a wrong credential
/// learns only that it will not work — not whether the tenant exists, whether the
/// address is registered, or which rule rejected them.
/// </summary>
public sealed class BootstrapActivationService(
    AppIdentityDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    IAccessProfileService accessProfiles) : IBootstrapActivationService
{
    public async Task<BootstrapActivationResult> ActivateAsync(
        BootstrapActivationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!BootstrapCredential.TryParse(request.Credential, out var selector, out var secret))
        {
            return new BootstrapActivationResult(BootstrapActivationOutcome.NotActivatable);
        }

        var email = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length == 0)
        {
            return new BootstrapActivationResult(BootstrapActivationOutcome.NotActivatable);
        }

        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        // Lock the invitation for the whole transaction so two submissions of the
        // same link cannot both pass the Pending check and each create a membership.
        if (dbContext.Database.IsRelational())
        {
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM identity.\"InviteTokens\" WHERE \"CredentialSelector\" = {0} FOR UPDATE",
                [selector], cancellationToken);
        }

        var invitation = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.CredentialSelector == selector, cancellationToken);

        // Unknown selector, wrong purpose, or a secret that does not verify are
        // all the same answer. Verification is constant-time.
        if (invitation is null
            || invitation.Purpose != InvitationPurpose.OrganizationBootstrap
            || !BootstrapCredential.MatchesDigest(secret, invitation.CredentialDigest))
        {
            return new BootstrapActivationResult(BootstrapActivationOutcome.NotActivatable);
        }

        if (invitation.State == InvitationState.Accepted)
        {
            // Neutral replay: no membership, access or audit is duplicated.
            return new BootstrapActivationResult(BootstrapActivationOutcome.AlreadyAccepted);
        }

        if (invitation.State != InvitationState.Pending
            || !string.Equals(invitation.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            await RecordRejectionAsync(invitation, "not_activatable", cancellationToken);
            return new BootstrapActivationResult(BootstrapActivationOutcome.NotActivatable);
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == invitation.TenantId, cancellationToken);

        // A suspended or offboarded tenant must not be reopened by an old
        // invitation: activating it would restore customer authority that was
        // administratively withdrawn.
        if (tenant is null
            || !tenant.IsActive
            || tenant.IsArchived
            || tenant.AdministratorActivationStatus == TenantAdministratorActivationStatus.Active)
        {
            await RecordRejectionAsync(invitation, "tenant_not_activatable", cancellationToken);
            return new BootstrapActivationResult(BootstrapActivationOutcome.NotActivatable);
        }

        var existing = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(user => user.NormalizedEmail == email.ToUpperInvariant(), cancellationToken);

        ApplicationUser account;
        if (existing is null)
        {
            var created = await CreateAccountAsync(request, email);
            if (created is null)
            {
                return new BootstrapActivationResult(BootstrapActivationOutcome.AccountIneligible);
            }

            account = created;
        }
        else
        {
            if (!await IsEligibleAsync(existing, cancellationToken))
            {
                await RecordRejectionAsync(invitation, "account_ineligible", cancellationToken);
                return new BootstrapActivationResult(BootstrapActivationOutcome.AccountIneligible);
            }

            account = existing;
        }

        // Exactly one new Active membership. Bootstrap never reactivates an old
        // membership or moves an account between tenants.
        var membership = TenantMembership.Create(account.Id, tenant.Id);
        dbContext.TenantMemberships.Add(membership);
        await dbContext.SaveChangesAsync(cancellationToken);

        // A freshly provisioned tenant has no access profiles yet.
        await accessProfiles.EnsureTenantAccessProfilesAsync(tenant.Id, cancellationToken);

        var orgAdminProfileId = await dbContext.AccessProfiles
            .IgnoreQueryFilters()
            .Where(profile => profile.TenantId == tenant.Id
                && profile.InternalKey == OrgAdminInternalKey)
            .Select(profile => profile.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (orgAdminProfileId == Guid.Empty)
        {
            throw new InvalidOperationException(
                $"Tenant {tenant.Id} has no {OrgAdminInternalKey} access profile; bootstrap cannot grant administration.");
        }

        // One correlation identifier ties the access audit and the bootstrap
        // outcome together.
        var correlationId = Guid.NewGuid();

        dbContext.UserAccessProfiles.Add(
            UserAccessProfile.ForMembership(membership, orgAdminProfileId));

        // The detailed permission change belongs in the existing access audit;
        // bootstrap history records only the outcome. Written inside the same
        // transaction so the grant and its trail cannot diverge.
        dbContext.AccessAuditEvents.Add(AccessAuditEvent.Create(
            tenantId: tenant.Id,
            actorUserId: account.Id,
            actorName: account.Email ?? string.Empty,
            actorRole: PlatformRole.OrgAdmin,
            action: "access.assignment.granted",
            resourceType: "UserAccessProfile",
            resourceId: orgAdminProfileId.ToString(),
            summary: "Initial Tenant Administrator access granted through bootstrap activation.",
            beforeJson: null,
            afterJson: null,
            correlationId: correlationId.ToString()));

        invitation.MarkAccepted(account.Id);
        tenant.CompleteAdministratorActivation();

        dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            TenantBootstrapAuditEventType.BootstrapCompleted,
            tenant.Id,
            correlationId,
            outcome: "Succeeded",
            invitationId: invitation.Id,
            actorAccountId: account.Id));

        await dbContext.SaveChangesAsync(cancellationToken);

        // Detailed permission history stays in the existing access audit; bootstrap
        // history records only the outcome.
        await accessProfiles.SyncCompatibilityRolesAsync(account, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return new BootstrapActivationResult(
            BootstrapActivationOutcome.Activated, tenant.Id, account.Id);
    }

    private const string OrgAdminInternalKey = "org-admin";

    /// <summary>
    /// An existing account may be used only when it is genuinely free to join.
    /// Any customer membership of any status disqualifies it: this MVP supports
    /// one customer membership per account and does not transfer or reactivate.
    /// </summary>
    private async Task<bool> IsEligibleAsync(ApplicationUser account, CancellationToken cancellationToken)
    {
        if (!account.IsActive)
        {
            return false;
        }

        if (await userManager.IsInRoleAsync(account, PlatformRole.PlatformAdmin))
        {
            return false;
        }

        // The locked rule is an account that "can authenticate". Accepting one
        // with no usable credential would consume the invitation and activate the
        // tenant for an administrator who can never sign in.
        var hasPassword = !string.IsNullOrEmpty(account.PasswordHash);
        var hasExternalLogin = (await userManager.GetLoginsAsync(account)).Count > 0;
        if (!hasPassword && !hasExternalLogin)
        {
            return false;
        }

        var hasAnyMembership = await dbContext.TenantMemberships
            .IgnoreQueryFilters()
            .AnyAsync(membership => membership.UserId == account.Id, cancellationToken);

        return !hasAnyMembership;
    }

    private async Task<ApplicationUser?> CreateAccountAsync(BootstrapActivationRequest request, string email)
    {
        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return null;
        }

        var account = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FirstName = request.FirstName?.Trim() ?? string.Empty,
            LastName = request.LastName?.Trim() ?? string.Empty,
            // Email control was proven by possession of the invitation link.
            EmailConfirmed = true,
            IsActive = true,
            HireDate = DateTime.UtcNow,
        };

        var result = await userManager.CreateAsync(account, request.Password);
        return result.Succeeded ? account : null;
    }

    /// <summary>
    /// Records a bounded, sanitized rejection. The reason is a code, never the
    /// submitted credential or address.
    /// </summary>
    private async Task RecordRejectionAsync(
        InviteToken invitation,
        string reason,
        CancellationToken cancellationToken)
    {
        dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            TenantBootstrapAuditEventType.ActivationRejected,
            invitation.TenantId,
            correlationId: Guid.NewGuid(),
            outcome: "Rejected",
            invitationId: invitation.Id,
            reason: reason));

        await dbContext.SaveChangesAsync(cancellationToken);

        // The caller returns immediately after this, so the surrounding
        // transaction would otherwise roll back and discard the very record that
        // explains why activation was refused.
        if (dbContext.Database.CurrentTransaction is { } active)
        {
            await active.CommitAsync(cancellationToken);
        }
    }
}
