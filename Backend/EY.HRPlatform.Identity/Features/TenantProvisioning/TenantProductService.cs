using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

public interface ITenantProductService
{
    Task<Result> SetEnabledAsync(Guid tenantId, string product, bool enabled, Guid actorAccountId, CancellationToken ct = default);
}

/// <summary>
/// Turns an optional product on or off for a tenant after provisioning (B-152). Off pauses the product, it doesn't
/// delete: its data, roles and role assignments are kept and become inert, since every call to the product requires the
/// entitlement. The built-in roles are re-composed from the tenant's entitlements, so they drop the product's grants
/// while it is off and get them back when it returns; custom roles are untouched. People's sessions pick the change up
/// as their access token renews. Core HR is mandatory and can't be turned off.
/// </summary>
public sealed class TenantProductService(
    AppIdentityDbContext dbContext,
    IAccessProfileService accessProfiles) : ITenantProductService
{
    public async Task<Result> SetEnabledAsync(
        Guid tenantId, string product, bool enabled, Guid actorAccountId, CancellationToken ct = default)
    {
        if (!Enum.TryParse<TenantModule>(product, ignoreCase: true, out var module) || !Enum.IsDefined(module))
        {
            return Result.Failure(new Error("products.not_found", "Unknown product."));
        }
        if (module == ProvisionableModuleCatalogue.Mandatory)
        {
            return Result.Failure(new Error("products.mandatory", $"{module} is included with every tenant and can't be turned off or on."));
        }

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
        if (tenant.IsArchived)
        {
            return Result.Failure(new Error("tenant.invalid_lifecycle_state", "An archived tenant's products can't change."));
        }

        var entitlement = await dbContext.TenantModuleEntitlements
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.Module == module, ct);
        // Already as asked: nothing changes and nothing is recorded.
        if (enabled == (entitlement is not null))
        {
            return Result.Success();
        }

        if (enabled)
        {
            dbContext.TenantModuleEntitlements.Add(TenantModuleEntitlement.Create(tenantId, module));
        }
        else
        {
            dbContext.TenantModuleEntitlements.Remove(entitlement!);
        }

        dbContext.TenantBootstrapAuditEvents.Add(TenantBootstrapAuditEvent.Create(
            enabled ? TenantBootstrapAuditEventType.ProductEnabled : TenantBootstrapAuditEventType.ProductDisabled,
            tenantId,
            correlationId: Guid.NewGuid(),
            outcome: "Succeeded",
            actorAccountId: actorAccountId,
            reason: module.ToString()));

        await dbContext.SaveChangesAsync(ct);
        await accessProfiles.EnsureTenantAccessProfilesAsync(tenantId, ct);

        if (dbContext.Database.CurrentTransaction is { } active)
        {
            await active.CommitAsync(ct);
        }

        return Result.Success();
    }
}
