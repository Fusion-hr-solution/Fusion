using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface ITenantProvisioningService
{
    Task<Result<ProvisionTenantResult>> ProvisionAsync(
        ProvisionTenantRequest request,
        Guid actorAccountId,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Creates one customer tenant and everything the Initial Tenant Administrator
/// needs to activate it, in a single Identity transaction.
///
/// Delivery deliberately happens outside this service: an email failure must not
/// roll back a committed tenant.
/// </summary>
public sealed class TenantProvisioningService(
    AppIdentityDbContext dbContext,
    IBootstrapInvitationDelivery delivery) : ITenantProvisioningService
{
    private const int BootstrapInvitationExpiryDays = 7;

    public async Task<Result<ProvisionTenantResult>> ProvisionAsync(
        ProvisionTenantRequest request,
        Guid actorAccountId,
        CancellationToken cancellationToken = default)
    {
        var validation = Validate(request);
        if (validation is not null)
        {
            return Result.Failure<ProvisionTenantResult>(validation);
        }

        var fingerprint = request.ComputeFingerprint();
        var idempotencyKey = request.IdempotencyKey.Trim();

        // An identical retry returns the stored result and redelivers nothing.
        // Reuse with different content is a conflict rather than a silent
        // no-op, because the caller would otherwise believe their new settings
        // were applied.
        var existing = await FindReceiptAsync(idempotencyKey, cancellationToken);
        if (existing is not null)
        {
            return existing.RequestFingerprint == fingerprint
                ? Result.Success<ProvisionTenantResult>(ToResult(existing))
                : Result.Failure<ProvisionTenantResult>(IdempotencyConflict);
        }

        var credential = BootstrapCredential.Issue();
        ProvisionTenantResult result;

        await using (var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken))
        {
            var tenant = Tenant.Create(Guid.NewGuid(), request.Name.Trim());
            tenant.ApplyInitialSettings(request.Locale, request.TimeZone);
            dbContext.Tenants.Add(tenant);

            foreach (var module in request.NormalizedModules())
            {
                dbContext.TenantModuleEntitlements.Add(
                    TenantModuleEntitlement.Create(tenant.Id, module));
            }

            var invitation = InviteToken.CreateOrganizationBootstrap(
                request.AdministratorEmail,
                tenant.Id,
                actorAccountId,
                BootstrapInvitationExpiryDays);
            invitation.IssueCredential(
                credential.Selector,
                BootstrapCredential.Digest(credential.Secret));
            dbContext.InviteTokens.Add(invitation);

            var correlationId = Guid.NewGuid();
            dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
                TenantBootstrapAuditEventType.TenantProvisioned,
                tenant.Id,
                correlationId,
                outcome: "Succeeded",
                invitationId: invitation.Id,
                actorAccountId: actorAccountId));

            var receipt = TenantProvisioningReceipt.Create(
                idempotencyKey, fingerprint, tenant.Id, invitation.Id);
            dbContext.TenantProvisioningReceipts.Add(receipt);

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception, out var constraint))
            {
                await transaction.RollbackAsync(cancellationToken);
                dbContext.ChangeTracker.Clear();

                // Concurrent identical requests collide on whichever unique index
                // the database happens to reach first — the receipt key or the
                // tenant name. Either way the question is the same: did another
                // caller already commit this exact request? If so both callers
                // observe the same tenant instead of one seeing a spurious
                // duplicate-name error.
                var committed = await FindReceiptAsync(idempotencyKey, cancellationToken);
                if (committed is not null)
                {
                    return committed.RequestFingerprint == fingerprint
                        ? Result.Success<ProvisionTenantResult>(ToResult(committed))
                        : Result.Failure<ProvisionTenantResult>(IdempotencyConflict);
                }

                if (constraint.Contains("Tenants_Name", StringComparison.OrdinalIgnoreCase))
                {
                    return Result.Failure<ProvisionTenantResult>(DuplicateTenantName);
                }

                throw;
            }

            result = new ProvisionTenantResult(tenant.Id, invitation.Id, receipt.CompletedAt);
        }

        // Post-commit. A delivery failure leaves a truthful Pending invitation the
        // Platform Administrator can resend; it never unwinds the tenant.
        //
        // CancellationToken.None deliberately: the tenant is already committed, so
        // a client disconnect must not abort delivery and lose its attempt record.
        // Resend remains the recovery path if delivery genuinely fails.
        await delivery.DeliverAsync(
            result.BootstrapInvitationId,
            request.AdministratorEmail.Trim(),
            credential,
            actorAccountId,
            CancellationToken.None);

        return Result.Success<ProvisionTenantResult>(result);
    }

    private async Task<TenantProvisioningReceipt?> FindReceiptAsync(
        string idempotencyKey,
        CancellationToken cancellationToken)
        => await dbContext.TenantProvisioningReceipts
            .AsNoTracking()
            .FirstOrDefaultAsync(receipt => receipt.IdempotencyKey == idempotencyKey, cancellationToken);

    private static ProvisionTenantResult ToResult(TenantProvisioningReceipt receipt)
        => new(receipt.TenantId, receipt.BootstrapInvitationId, receipt.CompletedAt);

    private static Error IdempotencyConflict => new(
        "provisioning.idempotency_conflict",
        "This idempotency key was already used for a different provisioning request.");

    private static Error DuplicateTenantName => new(
        "provisioning.duplicate_name",
        "Another tenant already uses this name.");

    private static Error? Validate(ProvisionTenantRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            return new Error("provisioning.idempotency_key_required", "An idempotency key is required.");

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length is < 2 or > 100)
            return new Error("provisioning.name_invalid", "Tenant name must be 2-100 characters.");

        // Locale and time zone become canonical tenant settings, so an unsupported
        // value must be refused here rather than surfacing later as broken
        // formatting or scheduling on a tenant that already exists.
        if (string.IsNullOrWhiteSpace(request.TimeZone))
            return new Error("provisioning.time_zone_required", "A time zone is required.");

        if (!TimeZoneInfo.TryFindSystemTimeZoneById(request.TimeZone.Trim(), out _))
            return new Error("provisioning.time_zone_unsupported", "The selected time zone is not supported.");

        if (!string.IsNullOrWhiteSpace(request.Locale) && !IsSupportedLocale(request.Locale.Trim()))
            return new Error("provisioning.locale_unsupported", "The selected locale is not supported.");

        var email = request.AdministratorEmail?.Trim() ?? string.Empty;
        if (email.Length == 0 || !email.Contains('@') || !email.Contains('.'))
            return new Error("provisioning.administrator_email_invalid", "A valid administrator email is required.");

        // Only modules this feature owns may be entitled. Training, Onboarding,
        // Interview, Learning and Recruitment are not provisionable here.
        if (request.Modules.Any(module => !Enum.IsDefined(module)))
            return new Error("provisioning.module_unsupported", "One or more selected modules are not supported.");

        return null;
    }

    /// <summary>
    /// A locale is supported when the runtime can resolve it to a real culture.
    /// The invariant culture is excluded because .NET returns it for unknown
    /// names, which would otherwise let any string through.
    /// </summary>
    private static bool IsSupportedLocale(string locale)
    {
        // GetCultureInfo happily manufactures a culture for an arbitrary
        // well-formed name, so asking it to parse proves nothing. Membership in
        // the installed culture list is what actually distinguishes a real locale
        // from a plausible-looking string.
        return System.Globalization.CultureInfo
            .GetCultures(System.Globalization.CultureTypes.AllCultures)
            .Any(culture => string.Equals(culture.Name, locale, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsUniqueViolation(DbUpdateException exception, out string constraint)
    {
        constraint = string.Empty;
        if (exception.InnerException is not PostgresException postgres || postgres.SqlState != "23505")
            return false;

        constraint = postgres.ConstraintName ?? string.Empty;
        return true;
    }
}
