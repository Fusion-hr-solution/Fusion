using System.Text.Json;
using System.Text.Json.Nodes;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

/// <summary>
/// Builds the JSONB override string from update requests.
/// Complements TenantSettingsMerger (read-side) with write-side logic.
/// </summary>
public static class TenantSettingsOverrideBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    /// <summary>
    /// Builds a new override JSON string by merging the update request into existing overrides.
    /// Returns null if the result would be empty (no overrides needed).
    /// </summary>
    public static string? Build(
        string? existingOverridesJson,
        List<string>? orgUnitTypes,
        Dictionary<string, FieldConfigInput>? employeeFieldConfig,
        BrandingSettingsInput? branding)
    {
        // Start from existing overrides or empty object
        var root = string.IsNullOrWhiteSpace(existingOverridesJson)
            ? new JsonObject()
            : JsonNode.Parse(existingOverridesJson)?.AsObject() ?? new JsonObject();

        // Update orgUnitTypes if provided
        if (orgUnitTypes is not null)
        {
            root["orgUnitTypes"] = JsonSerializer.SerializeToNode(orgUnitTypes, JsonOptions);
        }

        // Merge employeeFieldConfig if provided
        if (employeeFieldConfig is not null)
        {
            var existing = root["employeeFieldConfig"]?.AsObject() ?? new JsonObject();
            foreach (var (key, value) in employeeFieldConfig)
            {
                var fieldObj = existing[key]?.AsObject() ?? new JsonObject();

                if (value.Visible.HasValue)
                    fieldObj["visible"] = value.Visible.Value;
                if (value.Required.HasValue)
                    fieldObj["required"] = value.Required.Value;

                existing[key] = fieldObj;
            }
            root["employeeFieldConfig"] = existing;
        }

        // Merge branding if provided
        if (branding is not null)
        {
            var existing = root["branding"]?.AsObject() ?? new JsonObject();

            if (branding.LogoUrl is not null)
                existing["logoUrl"] = branding.LogoUrl;
            if (branding.PrimaryColor is not null)
                existing["primaryColor"] = branding.PrimaryColor;

            root["branding"] = existing;
        }

        // Return null if empty (no overrides)
        if (root.Count == 0)
            return null;

        return root.ToJsonString(JsonOptions);
    }
}
