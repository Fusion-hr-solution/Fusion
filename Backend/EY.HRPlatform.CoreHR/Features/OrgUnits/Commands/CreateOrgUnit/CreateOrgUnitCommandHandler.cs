using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.CreateOrgUnit;

public sealed class CreateOrgUnitCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : ICommandHandler<CreateOrgUnitCommand, Result<OrgUnitDto>>
{
    public async Task<Result<OrgUnitDto>> Handle(CreateOrgUnitCommand request, CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        // Validate org unit type against tenant settings
        await ValidateOrgUnitType(request.Type, cancellationToken);

        // Check for duplicate code within tenant
        var codeExists = await dbContext.OrgUnits
            .AnyAsync(o => o.Code == normalizedCode, cancellationToken);

        if (codeExists)
        {
            throw new DuplicateEntityException("OrgUnit", "code", normalizedCode);
        }

        // Check for duplicate name within tenant
        var normalizedName = request.Name.Trim();
        var nameExists = await dbContext.OrgUnits
            .AnyAsync(o => o.Name == normalizedName, cancellationToken);

        if (nameExists)
        {
            throw new DuplicateEntityException("OrgUnit", "name", normalizedName);
        }

        // Validate parent exists and is active (if specified)
        OrgUnit? parent = null;
        if (request.ParentId.HasValue && request.ParentId.Value != Guid.Empty)
        {
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
        }

        // Create org unit using domain factory
        var orgUnit = OrgUnit.Create(
            tenantId,
            request.Code,
            request.Name,
            request.Type,
            request.ParentId,
            request.ResponsibleManagerEmployeeId);

        dbContext.OrgUnits.Add(orgUnit);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Determine which field caused the violation
            if (ex.InnerException?.Message.Contains("Code") == true)
            {
                throw new DuplicateEntityException("OrgUnit", "code", normalizedCode);
            }
            throw new DuplicateEntityException("OrgUnit", "name", normalizedName);
        }

        return Result.Success(MapToDto(orgUnit, parent?.Name));
    }

    private async Task ValidateOrgUnitType(string type, CancellationToken cancellationToken)
    {
        // Get tenant settings (or defaults if none exist)
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

    private static OrgUnitDto MapToDto(OrgUnit orgUnit, string? parentName) => new(
        orgUnit.Id,
        orgUnit.Code,
        orgUnit.Name,
        orgUnit.Type,
        orgUnit.ParentId,
        parentName,
        orgUnit.IsActive,
        orgUnit.CreatedAt,
        orgUnit.UpdatedAt,
        orgUnit.Version,
        orgUnit.ResponsibleManagerEmployeeId);

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // PostgreSQL unique violation error code: 23505
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }
}
