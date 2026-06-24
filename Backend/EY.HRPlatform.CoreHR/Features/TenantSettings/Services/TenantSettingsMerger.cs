using System.Text.Json;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

/// <summary>
/// Merges tenant-specific setting overrides with platform defaults.
/// </summary>
public static class TenantSettingsMerger
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Merges platform defaults with tenant-specific overrides.
    /// Returns defaults if overrides is null/empty.
    /// </summary>
    public static TenantSettingsDto Merge(string? overridesJson, uint? version = null)
    {
        if (string.IsNullOrWhiteSpace(overridesJson))
            return TenantSettingsDto.Defaults with { Version = version };

        var overrides = JsonSerializer.Deserialize<TenantSettingsOverrides>(overridesJson, JsonOptions);
        if (overrides is null)
            return TenantSettingsDto.Defaults with { Version = version };

        var defaults = TenantSettingsDto.Defaults;
        var draftStructureSchema = overrides.DraftStructureSchema is not null
            ? MergeDraftStructureSchema(defaults.DraftStructureSchema, overrides.DraftStructureSchema)
            : overrides.OrgUnitTypes is not null
                ? ConvertLegacyOrgUnitTypes(overrides.OrgUnitTypes)
                : defaults.DraftStructureSchema;

        return new TenantSettingsDto
        {
            Version = version,
            DraftStructureSchema = draftStructureSchema,
            EmployeeFieldConfig = MergeFieldConfig(defaults.EmployeeFieldConfig, overrides.EmployeeFieldConfig),
            Branding = MergeBranding(defaults.Branding, overrides.Branding),
            SelfService = MergeSelfService(defaults.SelfService, overrides.SelfService),
            Provisioning = MergeProvisioning(defaults.Provisioning, overrides.Provisioning)
        };
    }

    private static DraftStructureSchemaDto MergeDraftStructureSchema(
        DraftStructureSchemaDto defaults,
        DraftStructureSchemaOverrides overrides)
    {
        var kinds = overrides.OrgUnitKinds is { Count: > 0 }
            ? overrides.OrgUnitKinds
                .Where(kind => !string.IsNullOrWhiteSpace(kind.Key) && !string.IsNullOrWhiteSpace(kind.DisplayLabel))
                .Select(kind => new OrgUnitKindDto(NormalizeKey(kind.Key), kind.DisplayLabel.Trim()))
                .GroupBy(kind => kind.Key, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList()
            : defaults.OrgUnitKinds;

        var attributes = overrides.Attributes is { Count: > 0 }
            ? overrides.Attributes
                .Where(attribute =>
                    !string.IsNullOrWhiteSpace(attribute.Key) &&
                    !string.IsNullOrWhiteSpace(attribute.DisplayLabel) &&
                    !string.IsNullOrWhiteSpace(attribute.ValueType))
                .Select(attribute => new DraftStructureAttributeDefinitionDto(
                    NormalizeKey(attribute.Key),
                    attribute.DisplayLabel.Trim(),
                    attribute.ValueType.Trim(),
                    attribute.Required ?? false,
                    attribute.AppliesToKindKeys?.Select(NormalizeKey).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    attribute.AllowedValues?.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value.Trim()).ToList()))
                .GroupBy(attribute => attribute.Key, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList()
            : defaults.Attributes;

        return new DraftStructureSchemaDto
        {
            OrgUnitKinds = kinds,
            Attributes = attributes
        };
    }

    private static DraftStructureSchemaDto ConvertLegacyOrgUnitTypes(List<string> orgUnitTypes)
    {
        var kinds = orgUnitTypes
            .Where(type => !string.IsNullOrWhiteSpace(type))
            .Select(type => new OrgUnitKindDto(NormalizeKey(type), type.Trim()))
            .GroupBy(type => type.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();

        return new DraftStructureSchemaDto
        {
            OrgUnitKinds = kinds.Count == 0 ? DraftStructureSchemaDto.DefaultOrgUnitKinds : kinds,
            Attributes = []
        };
    }

    private static Dictionary<string, FieldConfig> MergeFieldConfig(
        Dictionary<string, FieldConfig> defaults,
        Dictionary<string, FieldConfigOverrides>? overrides)
    {
        if (overrides is null || overrides.Count == 0)
            return defaults;

        // Start with defaults, then overlay overrides
        var merged = new Dictionary<string, FieldConfig>(defaults);
        foreach (var (key, value) in overrides)
        {
            var defaultConfig = defaults.TryGetValue(key, out var existing)
                ? existing
                : new FieldConfig(Visible: false, Required: false);

            merged[key] = new FieldConfig(
                Visible: value.Visible ?? defaultConfig.Visible,
                Required: value.Required ?? defaultConfig.Required,
                VisibleToEmployee: value.VisibleToEmployee ?? defaultConfig.VisibleToEmployee,
                VisibleToManager: value.VisibleToManager ?? defaultConfig.VisibleToManager);
        }
        return merged;
    }

    private static BrandingSettings MergeBranding(BrandingSettings defaults, BrandingSettingsOverrides? overrides)
    {
        if (overrides is null)
            return defaults;

        return new BrandingSettings
        {
            LogoUrl = overrides.LogoUrl ?? defaults.LogoUrl,
            PrimaryColor = overrides.PrimaryColor ?? defaults.PrimaryColor
        };
    }

    private static SelfServiceSettings MergeSelfService(
        SelfServiceSettings defaults,
        SelfServiceSettingsOverrides? overrides)
    {
        if (overrides is null)
        {
            return defaults;
        }

        return new SelfServiceSettings(
            CanEditPreferredName: overrides.CanEditPreferredName ?? defaults.CanEditPreferredName,
            CanEditPhone: overrides.CanEditPhone ?? defaults.CanEditPhone);
    }

    private static ProvisioningSettings MergeProvisioning(
        ProvisioningSettings defaults,
        ProvisioningSettingsOverrides? overrides)
    {
        if (overrides is null)
        {
            return defaults;
        }

        return new ProvisioningSettings(
            DefaultAccessProfileId: overrides.DefaultAccessProfileId ?? defaults.DefaultAccessProfileId,
            InviteExpiryDays: overrides.InviteExpiryDays ?? defaults.InviteExpiryDays,
            ResendCooldownHours: overrides.ResendCooldownHours ?? defaults.ResendCooldownHours,
            PendingInviteBehavior: overrides.PendingInviteBehavior ?? defaults.PendingInviteBehavior);
    }

    /// <summary>
    /// Internal type for deserializing partial overrides (all properties nullable).
    /// </summary>
    private sealed record TenantSettingsOverrides
    {
        public List<string>? OrgUnitTypes { get; init; }
        public DraftStructureSchemaOverrides? DraftStructureSchema { get; init; }
        public Dictionary<string, FieldConfigOverrides>? EmployeeFieldConfig { get; init; }
        public BrandingSettingsOverrides? Branding { get; init; }
        public SelfServiceSettingsOverrides? SelfService { get; init; }
        public ProvisioningSettingsOverrides? Provisioning { get; init; }
    }

    private sealed record DraftStructureSchemaOverrides
    {
        public List<OrgUnitKindOverrides>? OrgUnitKinds { get; init; }
        public List<DraftStructureAttributeDefinitionOverrides>? Attributes { get; init; }
    }

    private sealed record OrgUnitKindOverrides
    {
        public string Key { get; init; } = string.Empty;
        public string DisplayLabel { get; init; } = string.Empty;
    }

    private sealed record DraftStructureAttributeDefinitionOverrides
    {
        public string Key { get; init; } = string.Empty;
        public string DisplayLabel { get; init; } = string.Empty;
        public string ValueType { get; init; } = string.Empty;
        public bool? Required { get; init; }
        public List<string>? AppliesToKindKeys { get; init; }
        public List<string>? AllowedValues { get; init; }
    }

    private sealed record FieldConfigOverrides
    {
        public bool? Visible { get; init; }
        public bool? Required { get; init; }
        public bool? VisibleToEmployee { get; init; }
        public bool? VisibleToManager { get; init; }
    }

    private sealed record BrandingSettingsOverrides
    {
        public string? LogoUrl { get; init; }
        public string? PrimaryColor { get; init; }
    }

    private sealed record SelfServiceSettingsOverrides
    {
        public bool? CanEditPreferredName { get; init; }
        public bool? CanEditPhone { get; init; }
    }

    private sealed record ProvisioningSettingsOverrides
    {
        public Guid? DefaultAccessProfileId { get; init; }
        public int? InviteExpiryDays { get; init; }
        public int? ResendCooldownHours { get; init; }
        public string? PendingInviteBehavior { get; init; }
    }

    private static string NormalizeKey(string value)
    {
        var trimmed = value.Trim().ToLowerInvariant();
        var buffer = new System.Text.StringBuilder(trimmed.Length);
        var previousWasSeparator = false;

        foreach (var character in trimmed)
        {
            if (char.IsLetterOrDigit(character))
            {
                buffer.Append(character);
                previousWasSeparator = false;
                continue;
            }

            if (previousWasSeparator)
                continue;

            buffer.Append('-');
            previousWasSeparator = true;
        }

        return buffer.ToString().Trim('-');
    }
}
