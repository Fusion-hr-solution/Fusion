using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Commands.UpdateTenantSettings;

public sealed partial class UpdateTenantSettingsCommandHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : ICommandHandler<UpdateTenantSettingsCommand, Result<TenantSettingsDto>>
{
    private static readonly Regex HexColorPattern = HexColorRegex();

    // Derive known field names from the defaults to avoid duplication
    private static readonly HashSet<string> KnownFieldNames = 
        TenantSettingsDto.DefaultEmployeeFieldConfig.Keys.ToHashSet();

    // Core identity fields that cannot have any visibility flag set to false
    private static readonly HashSet<string> CoreFields = ["firstName", "lastName", "email"];

    public async Task<Result<TenantSettingsDto>> Handle(
        UpdateTenantSettingsCommand request,
        CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        // Query settings for current tenant (auto-filtered by global query filter)
        var settings = await dbContext.TenantSettings
            .FirstOrDefaultAsync(cancellationToken);

        // Validate OrgUnitType removal if types are being changed and settings exist
        if (request.OrgUnitTypes is not null && settings is not null)
        {
            var currentSettings = TenantSettingsMerger.Merge(settings.SettingsOverrides, settings.Version);
            await ValidateOrgUnitTypeRemoval(currentSettings.OrgUnitTypes, request.OrgUnitTypes, cancellationToken);
        }

        if (settings is null)
        {
            // Create new settings row for this tenant
            return await CreateSettings(request, cancellationToken);
        }

        // For updates to existing settings, require If-Match header
        if (!request.ExpectedVersion.HasValue)
        {
            throw new ConcurrencyException("TenantSettings", settings.Id);
        }

        if (settings.Version != request.ExpectedVersion.Value)
        {
            throw new ConcurrencyException("TenantSettings", settings.Id);
        }

        // Build new override JSON by merging request into existing
        var newOverrides = TenantSettingsOverrideBuilder.Build(
            settings.SettingsOverrides,
            request.OrgUnitTypes,
            request.EmployeeFieldConfig,
            request.Branding);

        settings.UpdateOverrides(newOverrides);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("TenantSettings", settings.Id);
        }

        return Result.Success(TenantSettingsMerger.Merge(settings.SettingsOverrides, settings.Version));
    }

    private async Task<Result<TenantSettingsDto>> CreateSettings(
        UpdateTenantSettingsCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;

        // Build override JSON from request
        var overrides = TenantSettingsOverrideBuilder.Build(
            null,
            request.OrgUnitTypes,
            request.EmployeeFieldConfig,
            request.Branding);

        var settings = Domain.Entities.TenantSettings.Create(tenantId, overrides);

        dbContext.TenantSettings.Add(settings);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Race condition: another request created settings first.
            // Treat as concurrency conflict - client should GET and retry with If-Match.
            var existingSettings = await dbContext.TenantSettings
                .FirstOrDefaultAsync(cancellationToken);

            if (existingSettings is not null)
            {
                throw new ConcurrencyException("TenantSettings", existingSettings.Id);
            }
            throw;
        }

        return Result.Success(TenantSettingsMerger.Merge(settings.SettingsOverrides, settings.Version));
    }

    private static void ValidateRequest(UpdateTenantSettingsCommand request)
    {
        // Validate orgUnitTypes
        if (request.OrgUnitTypes is not null)
        {
            if (request.OrgUnitTypes.Count == 0)
                throw new ArgumentException("OrgUnitTypes cannot be empty when provided.");

            if (request.OrgUnitTypes.Any(string.IsNullOrWhiteSpace))
                throw new ArgumentException("OrgUnitTypes cannot contain empty values.");

            if (request.OrgUnitTypes.Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.OrgUnitTypes.Count)
                throw new ArgumentException("OrgUnitTypes cannot contain duplicates.");
        }

        // Validate employeeFieldConfig
        if (request.EmployeeFieldConfig is not null)
        {
            var unknownFields = request.EmployeeFieldConfig.Keys
                .Where(k => !KnownFieldNames.Contains(k))
                .ToList();

            if (unknownFields.Count > 0)
                throw new ArgumentException($"Unknown field names: {string.Join(", ", unknownFields)}");

            // Core fields cannot be hidden or made optional for any role
            foreach (var (fieldName, config) in request.EmployeeFieldConfig)
            {
                if (!CoreFields.Contains(fieldName))
                    continue;

                if (config.Visible.HasValue && !config.Visible.Value)
                    throw new ArgumentException($"'{fieldName}' is a core field and cannot be hidden.");

                if (config.Required.HasValue && !config.Required.Value)
                    throw new ArgumentException($"'{fieldName}' is a core field and cannot be made optional.");

                if (config.VisibleToEmployee.HasValue && !config.VisibleToEmployee.Value)
                    throw new ArgumentException($"'{fieldName}' is a core field and must remain visible to employees.");

                if (config.VisibleToManager.HasValue && !config.VisibleToManager.Value)
                    throw new ArgumentException($"'{fieldName}' is a core field and must remain visible to managers.");
            }
        }

        // Validate branding
        if (request.Branding is not null)
        {
            if (request.Branding.PrimaryColor is not null && !HexColorPattern.IsMatch(request.Branding.PrimaryColor))
                throw new ArgumentException("PrimaryColor must be a valid hex color (e.g., #1a365d).");

            if (request.Branding.LogoUrl is not null &&
                !Uri.TryCreate(request.Branding.LogoUrl, UriKind.Absolute, out var uri))
                throw new ArgumentException("LogoUrl must be a valid absolute URL.");
        }
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // PostgreSQL unique violation error code: 23505
        return ex.InnerException?.Message.Contains("23505") == true
            || ex.InnerException?.Message.Contains("unique constraint") == true
            || ex.InnerException?.Message.Contains("duplicate key") == true;
    }

    /// <summary>
    /// Validates that no OrgUnitTypes being removed are in use by active OrgUnits.
    /// </summary>
    private async Task ValidateOrgUnitTypeRemoval(
        IList<string> currentTypes,
        IList<string> requestedTypes,
        CancellationToken cancellationToken)
    {
        var removedTypes = currentTypes
            .Except(requestedTypes, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (removedTypes.Count == 0)
            return;

        // Check if any removed types are in use by active OrgUnits
        var removedTypesLower = removedTypes.Select(t => t.ToLowerInvariant()).ToHashSet();
        
        var typesInUse = await dbContext.OrgUnits
            .Where(o => o.IsActive)
            .Select(o => o.Type.ToLower())
            .Distinct()
            .ToListAsync(cancellationToken);

        var conflictingTypes = typesInUse
            .Where(t => removedTypesLower.Contains(t))
            .ToList();

        if (conflictingTypes.Count > 0)
        {
            // Find original casing from the removed types
            var conflictingOriginal = removedTypes
                .Where(t => conflictingTypes.Contains(t.ToLowerInvariant()))
                .ToList();
            
            throw new ArgumentException(
                $"Cannot remove org unit type(s) '{string.Join("', '", conflictingOriginal)}' because they are in use by existing org units.");
        }
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexColorRegex();
}
