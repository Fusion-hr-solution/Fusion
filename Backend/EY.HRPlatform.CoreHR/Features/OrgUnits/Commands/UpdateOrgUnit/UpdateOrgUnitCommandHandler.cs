using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.UpdateOrgUnit;

public sealed class UpdateOrgUnitCommandHandler(
    CoreHRDbContext dbContext) : ICommandHandler<UpdateOrgUnitCommand, Result<OrgUnitDto>>
{
    public async Task<Result<OrgUnitDto>> Handle(
        UpdateOrgUnitCommand request,
        CancellationToken cancellationToken)
    {
        var orgUnit = await dbContext.OrgUnits
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (orgUnit is null)
        {
            throw new EntityNotFoundException("OrgUnit", request.Id);
        }

        // Check version for optimistic concurrency
        if (orgUnit.Version != request.ExpectedVersion)
        {
            throw new ConcurrencyException("OrgUnit", request.Id);
        }

        // Validate org unit type against tenant settings
        await ValidateOrgUnitType(request.Type, cancellationToken);

        // Check name uniqueness (if changed)
        var normalizedName = request.Name.Trim();
        if (!orgUnit.Name.Equals(normalizedName, StringComparison.Ordinal))
        {
            var nameExists = await dbContext.OrgUnits
                .AnyAsync(o => o.Id != request.Id && o.Name == normalizedName, cancellationToken);

            if (nameExists)
            {
                throw new DuplicateEntityException("OrgUnit", "name", normalizedName);
            }
        }

        // Validate parent and check for cycles
        OrgUnit? parent = null;
        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
            // Check for self-parent
            if (request.ParentId.Value == request.Id)
            {
                throw new ArgumentException("Org unit cannot be its own parent.");
            }

            parent = await dbContext.OrgUnits
                .FirstOrDefaultAsync(o => o.Id == request.ParentId.Value, cancellationToken);

            if (parent is null)
            {
                throw new EntityNotFoundException("Parent OrgUnit", request.ParentId.Value);
            }

            if (!parent.IsActive)
            {
                throw new ArgumentException("Cannot assign inactive org unit as parent.");
            }

            // Check for cycles in the hierarchy
            if (await WouldCreateCycle(request.Id, request.ParentId.Value, cancellationToken))
            {
                throw new ArgumentException("Cannot assign this parent as it would create a cycle in the hierarchy.");
            }
        }

        // Apply updates via domain method
        orgUnit.Update(request.Name, request.Type, request.ParentId, request.ResponsibleManagerEmployeeId);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("OrgUnit", request.Id);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            throw new DuplicateEntityException("OrgUnit", "name", normalizedName);
        }

        return Result.Success(new OrgUnitDto(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            orgUnit.ParentId,
            parent?.Name,
            orgUnit.IsActive,
            orgUnit.CreatedAt,
            orgUnit.UpdatedAt,
            orgUnit.Version,
            orgUnit.ResponsibleManagerEmployeeId));
    }

    private async Task<bool> WouldCreateCycle(Guid orgUnitId, Guid newParentId, CancellationToken cancellationToken)
    {
        // Walk up the parent chain from the new parent
        // If we encounter the org unit being updated, there's a cycle
        var visited = new HashSet<Guid> { orgUnitId };
        var current = newParentId;

        while (true)
        {
            if (visited.Contains(current))
            {
                return true; // Cycle detected
            }

            visited.Add(current);

            var parentId = await dbContext.OrgUnits
                .Where(o => o.Id == current)
                .Select(o => o.ParentId)
                .FirstOrDefaultAsync(cancellationToken);

            if (!parentId.HasValue)
            {
                return false; // Reached root, no cycle
            }

            current = parentId.Value;
        }
    }

    private async Task ValidateOrgUnitType(string type, CancellationToken cancellationToken)
    {
        var settings = await dbContext.TenantSettings
            .FirstOrDefaultAsync(cancellationToken);

        var mergedSettings = TenantSettingsMerger.Merge(settings?.SettingsOverrides, settings?.Version);

        var validTypes = mergedSettings.OrgUnitTypes;
        if (!validTypes.Any(t => t.Equals(type.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                $"Invalid org unit type '{type}'. Valid types are: {string.Join(", ", validTypes)}");
        }
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }
}
