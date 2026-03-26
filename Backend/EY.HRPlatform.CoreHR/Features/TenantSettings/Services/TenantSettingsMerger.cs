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
    public static TenantSettingsDto Merge(string? overridesJson)
    {
        if (string.IsNullOrWhiteSpace(overridesJson))
            return TenantSettingsDto.Defaults;

        var overrides = JsonSerializer.Deserialize<TenantSettingsOverrides>(overridesJson, JsonOptions);
        if (overrides is null)
            return TenantSettingsDto.Defaults;

        return MergeWithDefaults(overrides);
    }

    private static TenantSettingsDto MergeWithDefaults(TenantSettingsOverrides overrides)
    {
        var defaults = TenantSettingsDto.Defaults;

        return new TenantSettingsDto
        {
            OrgUnitTypes = overrides.OrgUnitTypes ?? defaults.OrgUnitTypes,
            EmployeeFieldConfig = MergeFieldConfig(defaults.EmployeeFieldConfig, overrides.EmployeeFieldConfig),
            Branding = MergeBranding(defaults.Branding, overrides.Branding)
        };
    }

    private static Dictionary<string, FieldConfig> MergeFieldConfig(
        Dictionary<string, FieldConfig> defaults,
        Dictionary<string, FieldConfig>? overrides)
    {
        if (overrides is null || overrides.Count == 0)
            return defaults;

        // Start with defaults, then overlay overrides
        var merged = new Dictionary<string, FieldConfig>(defaults);
        foreach (var (key, value) in overrides)
        {
            merged[key] = value;
        }
        return merged;
    }

    private static BrandingSettings MergeBranding(BrandingSettings defaults, BrandingSettings? overrides)
    {
        if (overrides is null)
            return defaults;

        return new BrandingSettings
        {
            LogoUrl = overrides.LogoUrl ?? defaults.LogoUrl,
            PrimaryColor = overrides.PrimaryColor ?? defaults.PrimaryColor
        };
    }

    /// <summary>
    /// Internal type for deserializing partial overrides (all properties nullable).
    /// </summary>
    private sealed record TenantSettingsOverrides
    {
        public List<string>? OrgUnitTypes { get; init; }
        public Dictionary<string, FieldConfig>? EmployeeFieldConfig { get; init; }
        public BrandingSettings? Branding { get; init; }
    }
}
