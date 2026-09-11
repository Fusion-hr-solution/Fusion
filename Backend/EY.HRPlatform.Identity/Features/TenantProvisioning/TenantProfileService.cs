using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface ITenantProfileService
{
    Task<Result> RenameAsync(Guid tenantId, string name, Guid actorAccountId, CancellationToken ct = default);
}

/// <summary>
/// Platform-owned edits to the tenant profile.
///
/// Only the organization display name is mutable here: the tenant key, created
/// timestamp, and internal id are immutable, and locale/time zone are
/// provisioning origins the customer workspace ultimately owns. Renaming leaves
/// the slug untouched, so the tenant's canonical key does not drift when its
/// display name changes.
/// </summary>
public sealed class TenantProfileService(AppIdentityDbContext dbContext) : ITenantProfileService
{
    public async Task<Result> RenameAsync(
        Guid tenantId, string name, Guid actorAccountId, CancellationToken ct = default)
    {
        await using var transaction = dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(ct)
            : null;

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == tenantId, ct);

        if (tenant is null)
        {
            return Result.Failure(new Error("tenant.not_found", "Tenant not found."));
        }

        try
        {
            tenant.Update(name);
        }
        catch (ArgumentException exception)
        {
            // The domain owns the name rule; its message travels back so the
            // field that caused it can carry the failure.
            return Result.Failure(new Error("tenant.invalid_name", exception.Message));
        }

        dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            TenantBootstrapAuditEventType.TenantProfileChanged,
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
