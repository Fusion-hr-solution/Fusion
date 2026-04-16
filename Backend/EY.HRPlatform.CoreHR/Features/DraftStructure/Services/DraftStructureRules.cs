using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public static class DraftStructureRules
{
    public static async Task EnsureSetupActivatedAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var setupState = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (setupState is null || setupState.CurrentPhase == TenantSetupPhase.NotStarted)
        {
            throw new ArgumentException("Setup must be activated before managing draft structure.");
        }
    }

    public static async Task<List<string>> GetAllowedTypesAsync(
        CoreHRDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        var mergedSettings = TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);
        return mergedSettings.OrgUnitTypes;
    }

    public static async Task ValidateTypeAsync(
        CoreHRDbContext dbContext,
        string type,
        CancellationToken cancellationToken)
    {
        var validTypes = await GetAllowedTypesAsync(dbContext, cancellationToken);
        if (!validTypes.Any(t => t.Equals(type.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                $"Invalid org unit type '{type}'. Valid types are: {string.Join(", ", validTypes)}");
        }
    }

    public static async Task<bool> WouldCreateCycleAsync(
        CoreHRDbContext dbContext,
        Guid draftOrgUnitId,
        Guid newParentId,
        CancellationToken cancellationToken)
    {
        var visited = new HashSet<Guid> { draftOrgUnitId };
        var current = newParentId;

        while (true)
        {
            if (visited.Contains(current))
            {
                return true;
            }

            visited.Add(current);

            var parentId = await dbContext.DraftOrgUnits
                .Where(o => o.Id == current)
                .Select(o => o.ParentId)
                .FirstOrDefaultAsync(cancellationToken);

            if (!parentId.HasValue)
            {
                return false;
            }

            current = parentId.Value;
        }
    }

    public static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }
}