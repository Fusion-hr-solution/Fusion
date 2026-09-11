using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface ITenantLifecycleService
{
    Task<Result> DeactivateAsync(Guid tenantId, Guid actorAccountId, CancellationToken ct = default);
    Task<Result> ReactivateAsync(Guid tenantId, Guid actorAccountId, CancellationToken ct = default);
}

/// <summary>
/// Platform-owned tenant lifecycle: the single Active↔Deactivated transition.
///
/// Deactivation removes customer access — enforced downstream by
/// <see cref="TenantContext.TenantOperationalStatus"/>, which reports a
/// deactivated tenant as suspended — while preserving all tenant data, so the
/// change is reversible. It governs access only; nothing here touches the
/// customer's workforce, configuration, or module data.
///
/// The transition is validated against the stored tenant, so a command built
/// from a stale view returns a conflict rather than forcing a redundant state.
/// </summary>
public sealed class TenantLifecycleService(AppIdentityDbContext dbContext) : ITenantLifecycleService
{
    public Task<Result> DeactivateAsync(Guid tenantId, Guid actorAccountId, CancellationToken ct = default)
        => TransitionAsync(
            tenantId,
            actorAccountId,
            apply: tenant => tenant.Deactivate(),
            eventType: TenantBootstrapAuditEventType.TenantDeactivated,
            ct);

    public Task<Result> ReactivateAsync(Guid tenantId, Guid actorAccountId, CancellationToken ct = default)
        => TransitionAsync(
            tenantId,
            actorAccountId,
            apply: tenant => tenant.Reactivate(),
            eventType: TenantBootstrapAuditEventType.TenantReactivated,
            ct);

    private async Task<Result> TransitionAsync(
        Guid tenantId,
        Guid actorAccountId,
        Action<Tenant> apply,
        TenantBootstrapAuditEventType eventType,
        CancellationToken ct)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        // A deactivated tenant is filtered from ordinary reads, so lifecycle
        // commands must see every tenant regardless of its current state.
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == tenantId, ct);

        if (tenant is null)
        {
            return Result.Failure(new Error("tenant.not_found", "Tenant not found."));
        }

        try
        {
            apply(tenant);
        }
        catch (InvalidOperationException exception)
        {
            // The tenant is already in the requested state (or archived): a
            // stale command the caller resolves by refreshing to the truth.
            return Result.Failure(new Error("tenant.invalid_lifecycle_state", exception.Message));
        }

        dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            eventType,
            tenant.Id,
            correlationId: Guid.NewGuid(),
            outcome: "Succeeded",
            actorAccountId: actorAccountId));

        await dbContext.SaveChangesAsync(ct);
        if (dbContext.Database.CurrentTransaction is { } active)
        {
            await active.CommitAsync(ct);
        }

        return Result.Success();
    }
}
