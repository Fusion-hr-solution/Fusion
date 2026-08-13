namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

public static class SettingsSectionIds
{
    public const string Overview = "overview";
    public const string Organization = "organization";
    public const string PeopleData = "people-data";
    public const string Structure = "structure";
    public const string AccessPermissions = "access-permissions";
    public const string Provisioning = "provisioning";
    public const string Governance = "governance";
}

public sealed record SettingsSectionDto(
    string Id,
    string ModuleId,
    string Group,
    string Label,
    string Description,
    bool Enabled,
    string Status,
    string StatusLabel,
    string Owner,
    string AuditNamespace,
    int Order,
    bool CanView,
    bool CanManage,
    IReadOnlyList<string> RequiredViewCapabilities,
    IReadOnlyList<string> RequiredManageCapabilities);

public sealed record SettingsHealthItemDto(
    string SectionId,
    string Severity,
    string Label,
    string Detail);

public sealed record SettingsOverviewDto(
    IReadOnlyList<SettingsSectionDto> Sections,
    IReadOnlyList<SettingsHealthItemDto> Health,
    IReadOnlyList<SettingsAuditEventDto> RecentSensitiveChanges);

public sealed record OrganizationSettingsDto(
    uint? Version,
    string DisplayName,
    string Locale,
    string TimeZone,
    BrandingSettings Branding,
    bool UsesDefaultBranding);

public sealed record PeopleDataSettingsDto(
    uint? Version,
    Dictionary<string, FieldConfig> EmployeeFieldConfig,
    SelfServiceSettings SelfService,
    IReadOnlyList<string> DownstreamConsumers);

public sealed record ProvisioningSettingsDto(
    uint? Version,
    ProvisioningSettings Provisioning,
    IReadOnlyList<string> DownstreamConsumers);

public sealed record SettingsAuditEventDto(
    Guid Id,
    DateTime OccurredAt,
    string ActorName,
    string ActorRole,
    string SectionId,
    string Action,
    string ResourceType,
    string? ResourceId,
    string Summary,
    string? BeforeJson,
    string? AfterJson,
    string? CorrelationId);
