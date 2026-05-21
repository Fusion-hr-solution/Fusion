using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Commands.UpdateTenantSettings;

/// <summary>
/// Command to update tenant settings with partial updates.
/// Supports upsert: creates settings if none exist, updates if they do.
/// </summary>
/// <param name="ExpectedVersion">Row version for optimistic concurrency. Null for first-time creation.</param>
/// <param name="OrgUnitTypes">Org unit types to set, or null to keep existing.</param>
/// <param name="DraftStructureSchema">Draft-structure schema to set, or null to keep existing.</param>
/// <param name="EmployeeFieldConfig">Field config overrides, or null to keep existing.</param>
/// <param name="Branding">Branding settings to update, or null to keep existing.</param>
public sealed record UpdateTenantSettingsCommand(
    uint? ExpectedVersion,
    List<string>? OrgUnitTypes,
    Dictionary<string, FieldConfigInput>? EmployeeFieldConfig,
    BrandingSettingsInput? Branding,
    DraftStructureSchemaDto? DraftStructureSchema = null) : ICommand<Result<TenantSettingsDto>>;
