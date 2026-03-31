namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Request payload for partial tenant settings updates.
/// All properties are nullable to support true partial updates.
/// </summary>
public sealed record UpdateTenantSettingsRequest(
    List<string>? OrgUnitTypes,
    Dictionary<string, FieldConfigInput>? EmployeeFieldConfig,
    BrandingSettingsInput? Branding
);

/// <summary>
/// Input type for field configuration with nullable properties for partial updates.
/// </summary>
public sealed record FieldConfigInput(
    bool? Visible,
    bool? Required,
    bool? VisibleToEmployee,
    bool? VisibleToManager
);

/// <summary>
/// Input type for branding settings with nullable properties for partial updates.
/// </summary>
public sealed record BrandingSettingsInput(string? LogoUrl, string? PrimaryColor);
