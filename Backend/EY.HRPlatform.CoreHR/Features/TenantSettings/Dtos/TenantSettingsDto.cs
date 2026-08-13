namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

/// <summary>
/// Tenant-level configuration settings.
/// Used as the response shape and to define defaults.
/// </summary>
public sealed record TenantSettingsDto
{
    /// <summary>
    /// Row version for optimistic concurrency (used in ETag).
    /// Null when returning defaults (no database row exists).
    /// </summary>
    public uint? Version { get; init; }

    /// <summary>
    /// Field visibility and requirement configuration for employee records.
    /// </summary>
    public Dictionary<string, FieldConfig> EmployeeFieldConfig { get; init; } = DefaultEmployeeFieldConfig;

    /// <summary>
    /// Tenant branding configuration.
    /// </summary>
    public BrandingSettings Branding { get; init; } = new();

    /// <summary>
    /// Employee self-service editing policies.
    /// </summary>
    public SelfServiceSettings SelfService { get; init; } = new();

    /// <summary>
    /// Workforce account provisioning and invitation defaults.
    /// </summary>
    public ProvisioningSettings Provisioning { get; init; } = new();

    /// <summary>
    /// Default field configuration for employee records.
    /// All fields default to visible for all roles.
    /// </summary>
    public static Dictionary<string, FieldConfig> DefaultEmployeeFieldConfig => new()
    {
        ["firstName"] = new(Visible: true, Required: true, VisibleToEmployee: true, VisibleToManager: true),
        ["lastName"] = new(Visible: true, Required: true, VisibleToEmployee: true, VisibleToManager: true),
        ["email"] = new(Visible: true, Required: true, VisibleToEmployee: true, VisibleToManager: true),
        ["hireDate"] = new(Visible: true, Required: true, VisibleToEmployee: true, VisibleToManager: true),
        ["phone"] = new(Visible: true, Required: false, VisibleToEmployee: true, VisibleToManager: true),
        ["jobTitle"] = new(Visible: true, Required: false, VisibleToEmployee: true, VisibleToManager: true),
        ["workLocation"] = new(Visible: true, Required: false, VisibleToEmployee: true, VisibleToManager: true),
        ["employmentType"] = new(Visible: true, Required: false, VisibleToEmployee: true, VisibleToManager: true)
    };

    /// <summary>
    /// Creates a new instance with all default values.
    /// </summary>
    public static TenantSettingsDto Defaults => new();
}

public sealed record SelfServiceSettings(
    bool CanEditPreferredName = true,
    bool CanEditPhone = true);

public sealed record ProvisioningSettings(
    Guid? DefaultAccessProfileId = null,
    int InviteExpiryDays = 14,
    int ResendCooldownHours = 24,
    string PendingInviteBehavior = "RefreshExisting");
