using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Validates tenant context on SaveChanges operations:
/// - New entities must have a valid TenantId that matches the current tenant
/// - Existing entities cannot have their TenantId modified
/// </summary>
public sealed class TenantSaveChangesInterceptor(ITenantContext tenantContext) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
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
        if (context is null)
            return;

        foreach (var entry in context.ChangeTracker.Entries<Employee>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    ValidateNewEntity(entry.Entity);
                    break;

                case EntityState.Modified:
                    ValidateModifiedEntity(entry);
                    break;
            }
        }
    }

    private void ValidateNewEntity(Employee entity)
    {
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException(
                "Cannot save Employee without resolved tenant context.");

        if (entity.TenantId == Guid.Empty)
            throw new InvalidOperationException(
                "TenantId must be set on new Employee entities.");

        if (entity.TenantId != tenantContext.TenantId)
            throw new InvalidOperationException(
                $"Cannot create Employee for tenant {entity.TenantId} in context of tenant {tenantContext.TenantId}.");
    }

    private void ValidateModifiedEntity(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<Employee> entry)
    {
        var tenantIdProperty = entry.Property(e => e.TenantId);

        if (tenantIdProperty.IsModified)
            throw new InvalidOperationException(
                "TenantId cannot be modified on existing Employee entities.");

        // Ensure update is within current tenant context
        if (tenantContext.IsResolved && entry.Entity.TenantId != tenantContext.TenantId)
            throw new InvalidOperationException(
                $"Cannot modify Employee belonging to tenant {entry.Entity.TenantId} in context of tenant {tenantContext.TenantId}.");
    }
}
