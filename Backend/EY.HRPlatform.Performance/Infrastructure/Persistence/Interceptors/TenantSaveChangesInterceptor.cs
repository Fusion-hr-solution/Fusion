using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Validates tenant context on SaveChanges for every <see cref="ITenantEntity"/>: new entities
/// must carry the current tenant, existing entities cannot have their TenantId changed, and no
/// write may run without a resolved tenant context. Fail-closed alongside the query filter.
/// </summary>
public sealed class TenantSaveChangesInterceptor(ITenantContext tenantContext) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ValidateTenantContext(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ValidateTenantContext(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void ValidateTenantContext(DbContext? context)
    {
        if (context is null) return;

        foreach (var entry in context.ChangeTracker.Entries<ITenantEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    ValidateNewEntity(entry.Entity);
                    break;
                case EntityState.Modified:
                    ValidateModifiedEntity(entry);
                    break;
                case EntityState.Deleted:
                    ValidateDeletedEntity(entry);
                    break;
            }
        }
    }

    private void ValidateNewEntity(ITenantEntity entity)
    {
        if (!tenantContext.IsResolved)
            throw new TenantAccessDeniedException("Cannot save entity without resolved tenant context.");
        if (entity.TenantId == Guid.Empty)
            throw new TenantAccessDeniedException("TenantId must be set on new entities.");
        if (entity.TenantId != tenantContext.TenantId)
            throw new TenantAccessDeniedException("Cannot create entity for a different tenant than the current context.");
    }

    private void ValidateModifiedEntity(EntityEntry<ITenantEntity> entry)
    {
        if (!tenantContext.IsResolved)
            throw new TenantAccessDeniedException("Cannot modify entity without resolved tenant context.");
        // Guard on a genuine change of value, not merely the modified flag: replacing an
        // owned collection can flag every property as modified while the tenant is unchanged.
        var tenantProperty = entry.Property(e => e.TenantId);
        if (tenantProperty.IsModified && !Equals(tenantProperty.OriginalValue, entry.Entity.TenantId))
            throw new TenantAccessDeniedException("TenantId cannot be modified on existing entities.");
        if (entry.Entity.TenantId != tenantContext.TenantId)
            throw new TenantAccessDeniedException("Cannot modify entity belonging to a different tenant than the current context.");
    }

    private void ValidateDeletedEntity(EntityEntry<ITenantEntity> entry)
    {
        if (!tenantContext.IsResolved)
            throw new TenantAccessDeniedException("Cannot delete entity without resolved tenant context.");
        if (entry.Entity.TenantId != tenantContext.TenantId)
            throw new TenantAccessDeniedException("Cannot delete entity belonging to a different tenant than the current context.");
    }
}
