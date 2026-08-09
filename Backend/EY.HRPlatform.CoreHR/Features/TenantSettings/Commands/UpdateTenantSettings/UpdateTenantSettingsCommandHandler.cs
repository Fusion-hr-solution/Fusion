using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Services;
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

    // Identity fields cannot have visibility flags set to false and stay required.
    private static readonly HashSet<string> CoreIdentityFields = ["firstName", "lastName", "email"];

    // Hire date remains required until create/import flows support records without it.
    private static readonly HashSet<string> OperationallyRequiredFields = ["firstName", "lastName", "email", "hireDate"];

    public async Task<Result<TenantSettingsDto>> Handle(
        UpdateTenantSettingsCommand request,
        CancellationToken cancellationToken)
    {
        if (request.OrgUnitTypes is not null || request.DraftStructureSchema is not null)
            throw new ArgumentException(
                "Organization Types are managed through the canonical Organization API; Draft Structure settings are retired.");
        ValidateRequest(request);
        var requestedSchema = BuildRequestedSchema(request);

        if (requestedSchema is not null)
        {
            await DraftStructureRules.EnsureDraftEditableAsync(dbContext, cancellationToken);
        }

        // Query settings for current tenant (auto-filtered by global query filter)
        var settings = await dbContext.TenantSettings
            .FirstOrDefaultAsync(cancellationToken);

        if (requestedSchema is not null)
        {
            var currentSettings = settings is null
                ? TenantSettingsDto.Defaults
                : TenantSettingsMerger.Merge(settings.SettingsOverrides, settings.Version);

            await ValidateDraftStructureKindRemoval(
                currentSettings.DraftStructureSchema,
                requestedSchema,
                cancellationToken);
        }

        if (settings is null)
        {
            // Create new settings row for this tenant
            return await CreateSettings(request, requestedSchema, cancellationToken);
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
            request.Branding,
            requestedSchema,
            request.SelfService,
            request.Provisioning);

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
        DraftStructureSchemaDto? requestedSchema,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;

        // Build override JSON from request
        var overrides = TenantSettingsOverrideBuilder.Build(
            null,
            request.OrgUnitTypes,
            request.EmployeeFieldConfig,
            request.Branding,
            requestedSchema,
            request.SelfService,
            request.Provisioning);

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
        if (request.OrgUnitTypes is not null && request.DraftStructureSchema is not null)
            throw new ArgumentException("Provide either OrgUnitTypes or DraftStructureSchema, not both.");

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

        if (request.DraftStructureSchema is not null)
        {
            if (request.DraftStructureSchema.OrgUnitKinds.Count == 0)
                throw new ArgumentException("DraftStructureSchema must include at least one org unit kind.");

            if (request.DraftStructureSchema.OrgUnitKinds.Any(kind => string.IsNullOrWhiteSpace(kind.Key)))
                throw new ArgumentException("DraftStructureSchema org unit kind keys cannot be empty.");

            if (request.DraftStructureSchema.OrgUnitKinds.Any(kind => string.IsNullOrWhiteSpace(kind.DisplayLabel)))
                throw new ArgumentException("DraftStructureSchema org unit kind labels cannot be empty.");

            var normalizedKeys = request.DraftStructureSchema.OrgUnitKinds
                .Select(kind => DraftStructureRules.NormalizeKindKey(kind.Key))
                .ToList();

            if (normalizedKeys.Distinct(StringComparer.OrdinalIgnoreCase).Count() != normalizedKeys.Count)
                throw new ArgumentException("DraftStructureSchema cannot contain duplicate org unit kind keys.");

            var normalizedLabels = request.DraftStructureSchema.OrgUnitKinds
                .Select(kind => kind.DisplayLabel.Trim())
                .ToList();

            if (normalizedLabels.Distinct(StringComparer.OrdinalIgnoreCase).Count() != normalizedLabels.Count)
                throw new ArgumentException("DraftStructureSchema cannot contain duplicate org unit kind labels.");

            var normalizedSchema = DraftStructureRules.NormalizeDraftStructureSchema(request.DraftStructureSchema);
            var validKindKeys = normalizedSchema.OrgUnitKinds
                .Select(kind => kind.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var invalidAttributeReferences = normalizedSchema.Attributes
                .SelectMany(attribute => (attribute.AppliesToKindKeys ?? [])
                    .Where(kindKey => !validKindKeys.Contains(kindKey))
                    .Select(kindKey => (attribute.Key, KindKey: kindKey)))
                .ToList();

            if (invalidAttributeReferences.Count > 0)
            {
                var firstInvalidReference = invalidAttributeReferences[0];
                throw new ArgumentException(
                    $"Attribute '{firstInvalidReference.Key}' references unknown org unit kind '{firstInvalidReference.KindKey}'.");
            }
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
                if (CoreIdentityFields.Contains(fieldName))
                {
                    if (config.Visible.HasValue && !config.Visible.Value)
                        throw new ArgumentException($"'{fieldName}' is a core field and cannot be hidden.");

                    if (config.VisibleToEmployee.HasValue && !config.VisibleToEmployee.Value)
                        throw new ArgumentException($"'{fieldName}' is a core field and must remain visible to employees.");

                    if (config.VisibleToManager.HasValue && !config.VisibleToManager.Value)
                        throw new ArgumentException($"'{fieldName}' is a core field and must remain visible to managers.");
                }

                if (OperationallyRequiredFields.Contains(fieldName)
                    && config.Required.HasValue
                    && !config.Required.Value)
                {
                    throw new ArgumentException(
                        CoreIdentityFields.Contains(fieldName)
                            ? $"'{fieldName}' is a core field and cannot be made optional."
                            : $"'{fieldName}' is operationally required and cannot be made optional.");
                }
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

        if (request.Provisioning is not null)
        {
            if (request.Provisioning.DefaultAccessProfileId == Guid.Empty)
                throw new ArgumentException("DefaultAccessProfileId must be null or a valid profile id.");

            if (request.Provisioning.InviteExpiryDays is < 1 or > 90)
                throw new ArgumentException("InviteExpiryDays must be between 1 and 90.");

            if (request.Provisioning.ResendCooldownHours is < 0 or > 720)
                throw new ArgumentException("ResendCooldownHours must be between 0 and 720.");

            if (request.Provisioning.PendingInviteBehavior is not null
                && request.Provisioning.PendingInviteBehavior is not "RefreshExisting" and not "KeepExisting")
            {
                throw new ArgumentException("PendingInviteBehavior must be RefreshExisting or KeepExisting.");
            }
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
    private async Task ValidateDraftStructureKindRemoval(
        DraftStructureSchemaDto currentSchema,
        DraftStructureSchemaDto requestedSchema,
        CancellationToken cancellationToken)
    {
        var currentNormalizedSchema = DraftStructureRules.NormalizeDraftStructureSchema(currentSchema);
        var requestedNormalizedSchema = DraftStructureRules.NormalizeDraftStructureSchema(requestedSchema);

        var removedTypes = currentNormalizedSchema.OrgUnitKinds
            .Select(kind => kind.DisplayLabel)
            .Except(
                requestedNormalizedSchema.OrgUnitKinds.Select(kind => kind.DisplayLabel),
                StringComparer.OrdinalIgnoreCase)
            .ToList();

        await ValidateOrgUnitTypeRemoval(removedTypes, cancellationToken);

        var removedKindKeys = currentNormalizedSchema.OrgUnitKinds
            .Select(kind => kind.Key)
            .Except(
                requestedNormalizedSchema.OrgUnitKinds.Select(kind => kind.Key),
                StringComparer.OrdinalIgnoreCase)
            .ToList();

        await ValidateDraftOrgUnitKindRemoval(removedKindKeys, cancellationToken);
    }

    private static DraftStructureSchemaDto? BuildRequestedSchema(UpdateTenantSettingsCommand request)
    {
        if (request.DraftStructureSchema is not null)
        {
            return DraftStructureRules.NormalizeDraftStructureSchema(request.DraftStructureSchema);
        }

        if (request.OrgUnitTypes is null)
        {
            return null;
        }

        return DraftStructureRules.NormalizeDraftStructureSchema(
            new DraftStructureSchemaDto
            {
                OrgUnitKinds = request.OrgUnitTypes
                    .Select(type => new OrgUnitKindDto(type, type))
                    .ToList(),
                Attributes = []
            });
    }

    private async Task ValidateOrgUnitTypeRemoval(
        IList<string> removedTypes,
        CancellationToken cancellationToken)
    {
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

    private async Task ValidateDraftOrgUnitKindRemoval(
        IList<string> removedKindKeys,
        CancellationToken cancellationToken)
    {
        if (removedKindKeys.Count == 0)
            return;

        var removedKindKeysLower = removedKindKeys
            .Select(kindKey => DraftStructureRules.NormalizeKindKey(kindKey))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var kindKeysInUse = await dbContext.DraftOrgUnits
            .Select(draftOrgUnit => draftOrgUnit.OrgUnitKindKey.ToLower())
            .Distinct()
            .ToListAsync(cancellationToken);

        var conflictingKindKeys = kindKeysInUse
            .Where(kindKey => removedKindKeysLower.Contains(kindKey))
            .ToList();

        if (conflictingKindKeys.Count == 0)
            return;

        var conflictingOriginal = removedKindKeys
            .Where(kindKey => conflictingKindKeys.Contains(DraftStructureRules.NormalizeKindKey(kindKey)))
            .ToList();

        throw new ArgumentException(
            $"Cannot remove draft org unit kind(s) '{string.Join("', '", conflictingOriginal)}' because they are in use by existing draft org units.");
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexColorRegex();
}
