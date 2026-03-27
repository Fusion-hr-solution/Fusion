namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Tenant-level configuration settings.
/// Used as the response shape and to define defaults.
/// </summary>
public sealed record TenantSettingsDto
{
    /// <summary>
    /// Allowed organizational unit types for this tenant.
    /// </summary>
    public List<string> OrgUnitTypes { get; init; } = ["Department", "Team"];

    /// <summary>
    /// Field visibility and requirement configuration for employee records.
    /// </summary>
    public Dictionary<string, FieldConfig> EmployeeFieldConfig { get; init; } = DefaultEmployeeFieldConfig;

    /// <summary>
    /// Tenant branding configuration.
    /// </summary>
    public BrandingSettings Branding { get; init; } = new();

    /// <summary>
    /// Default field configuration for employee records.
    /// </summary>
    public static Dictionary<string, FieldConfig> DefaultEmployeeFieldConfig => new()
    {
        ["firstName"] = new(Visible: true, Required: true),
        ["lastName"] = new(Visible: true, Required: true),
        ["email"] = new(Visible: true, Required: true),
        ["hireDate"] = new(Visible: true, Required: true),
        ["phone"] = new(Visible: true, Required: false),
        ["jobTitle"] = new(Visible: true, Required: false)
    };

    /// <summary>
    /// Creates a new instance with all default values.
    /// </summary>
    public static TenantSettingsDto Defaults => new();
}
